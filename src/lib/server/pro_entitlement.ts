/**
 * VetNotes Pro entitlement (server authority)
 *
 * WHY THIS IS NOT THE `plan` CLAIM
 * --------------------------------
 * `$lib/constants/plans` states the invariant plainly: VetSorcery's
 * `stripeWebhook.ts` is the ONLY writer of paid state (the `plan` custom auth
 * claim, `users/{uid}.plan`, `clinics/{id}.subscription.plan`). That file exists
 * because two readers of that signal drifted apart and silently paywalled paying
 * clinics. Adding a second WRITER would be a worse version of the same defect —
 * two systems racing to define what "paid" means, and `setCustomUserClaims`
 * REPLACES the whole claims object, so a careless write drops the clinic's
 * existing claims entirely.
 *
 * So a VetNotes Pro subscription is recorded as its own entitlement document,
 * exactly like the CPD Pass in `cpd_entitlement.ts`. A user is Pro if EITHER:
 *   1. they hold a paid VetSorcery plan (Pro is bundled into those tiers), OR
 *   2. they hold an active VetNotes Pro entitlement bought on vetnotes.me.
 *
 * Reads go through the server (Admin SDK) rather than a client Firestore query,
 * so this needs no `firestore.rules` change. That is deliberate: PROB-027 was a
 * rules edit that broke all three onboarding flows, and a default-deny ruleset
 * would silently fail a client read of a brand-new collection anyway.
 */
import { adminAuth, adminDb, FieldValue } from '$lib/server/firebase-admin';
import { isPaidPlan } from '$lib/constants/plans';

const COLLECTION = 'vetnotes_pro_entitlements';

export interface ProGrantMeta {
	source: string;
	stripeSessionId?: string;
	stripeCustomerId?: string;
	stripeSubscriptionId?: string;
	email?: string;
}

/**
 * Does this user hold a paid VetSorcery subscription?
 *
 * Mirrors `cpd_entitlement.hasPaidSubscription` in both order and intent: claim
 * first (canonical, unforgeable, no Firestore read), then the user doc, then the
 * clinic record for a seat user whose token predates the claim. Every lookup is
 * wrapped so a transient failure falls through rather than reporting "not paid".
 */
async function hasPaidVetSorceryPlan(userId: string): Promise<boolean> {
	try {
		const rec = await adminAuth.getUser(userId);
		const claims = (rec.customClaims || {}) as Record<string, unknown>;
		if (isPaidPlan(claims.plan)) return true;
	} catch {
		/* fall through to the document sources */
	}

	let clinicId: string | undefined;
	try {
		const userSnap = await adminDb.collection('users').doc(userId).get();
		if (userSnap.exists) {
			const data = userSnap.data() || {};
			if (isPaidPlan(data.plan)) return true;
			clinicId = typeof data.clinicId === 'string' ? data.clinicId : undefined;
		}
	} catch {
		/* fall through */
	}

	if (clinicId) {
		try {
			const clinicSnap = await adminDb.collection('clinics').doc(clinicId).get();
			const sub = clinicSnap.data()?.subscription;
			if (isPaidPlan(sub?.plan, sub?.status)) return true;
		} catch {
			/* fall through */
		}
	}

	return false;
}

/** Is this user entitled to VetNotes Pro right now? */
export async function hasProEntitlement(userId: string): Promise<boolean> {
	if (!userId) return false;

	if (await hasPaidVetSorceryPlan(userId)) return true;

	try {
		const snap = await adminDb.collection(COLLECTION).doc(userId).get();
		if (!snap.exists) return false;
		const data = snap.data() || {};
		if (data.active !== true) return false;

		/* A subscription entitlement is kept alive by renewal and cleared on
		   `customer.subscription.deleted`. `expires_at` is a belt-and-braces stop
		   for the case where that event is never delivered. */
		const expiresAt = data.expires_at;
		if (expiresAt) {
			const ms = typeof expiresAt === 'string' ? Date.parse(expiresAt) : expiresAt?.toMillis?.();
			if (Number.isFinite(ms) && ms < Date.now()) return false;
		}
		return true;
	} catch (err) {
		console.error('[Pro] entitlement read failed', err);
		return false;
	}
}

/** Grant Pro. Idempotent — re-running on a redelivered webhook is a no-op. */
export async function grantProEntitlement(userId: string, meta: ProGrantMeta): Promise<void> {
	if (!userId) return;
	await adminDb
		.collection(COLLECTION)
		.doc(userId)
		.set(
			{
				active: true,
				plan: 'vetnotes_pro',
				source: meta.source,
				expires_at: null,
				stripe_session_id: meta.stripeSessionId ?? null,
				stripe_customer_id: meta.stripeCustomerId ?? null,
				stripe_subscription_id: meta.stripeSubscriptionId ?? null,
				email: meta.email ?? null,
				granted_at: FieldValue.serverTimestamp()
			},
			{ merge: true }
		);
}

/** Revoke Pro (cancellation, or a failed final payment). */
export async function revokeProEntitlement(userId: string, reason: string): Promise<void> {
	if (!userId) return;
	await adminDb
		.collection(COLLECTION)
		.doc(userId)
		.set(
			{
				active: false,
				revoked_reason: reason,
				revoked_at: FieldValue.serverTimestamp()
			},
			{ merge: true }
		);
}
