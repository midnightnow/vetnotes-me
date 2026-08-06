/**
 * CPD Entitlement (server authority)
 *
 * Model: an **all-access CPD Pass**. One purchase unlocks the verifiable
 * certificate on every case (matches the single `cpd_entitlements/{uid}` record).
 * A user is entitled by EITHER:
 *   1. An active paid subscription tier on `users/{uid}` (pro/enterprise/starter)
 *      — CPD certification is bundled into those plans; OR
 *   2. An active CPD Pass in `cpd_entitlements/{uid}` (optionally time-boxed via
 *      `expires_at` for a subscription/annual pass).
 *
 * Learning and scoring stay free for everyone. This gate only controls issuance
 * of the certificate ("pay to certify"). Default pricing model = one-off pass
 * (lifetime, no expiry); set `CPD_CHECKOUT_MODE=subscription` for a recurring one.
 */
import { adminAuth, adminDb } from '$lib/server/firebase-admin';
import { isPaidPlan } from '$lib/constants/plans';

export interface GrantMeta {
  source: string;
  plan?: string; // 'all_access' (default)
  expiresAt?: string | null; // ISO; omit/null = no expiry (lifetime pass)
  stripeSessionId?: string;
  stripeCustomerId?: string;
  email?: string;
}

/**
 * Does this user hold a paid VetSorcery subscription?
 *
 * Reads the same signal the Stripe webhook actually writes, in descending order
 * of authority. Every lookup is wrapped: a transient auth/Firestore failure must
 * not be reported as "not paid" without at least trying the next source.
 */
async function hasPaidSubscription(userId: string): Promise<boolean> {
  // (a) Server-set custom auth claim — canonical and unforgeable.
  try {
    const rec = await adminAuth.getUser(userId);
    const claims = (rec.customClaims || {}) as Record<string, unknown>;
    if (isPaidPlan(claims.plan)) return true;
  } catch {
    /* fall through to the document sources */
  }

  // (b) The user document, which the webhook also writes.
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

  // (c) The clinic record — the billable unit is the clinic, so a seat user whose
  //     own token predates the claim still resolves correctly here.
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

export async function hasCpdEntitlement(userId: string): Promise<boolean> {
  if (!userId) return false;

  // 1. Bundled with a paid subscription.
  //
  // FIXED: this previously read `users/{uid}.subscription.tier` /
  // `.subscriptionTier`. **Nothing has ever written either field.** VetSorcery's
  // `stripeWebhook.ts` writes the `plan` custom auth claim, `users/{uid}.plan`,
  // and `clinics/{id}.subscription.plan`. So this branch returned false for every
  // practitioner who has ever existed, and a clinic on a paid VetSorcery plan was
  // paywalled after passing a case. The sibling client gate
  // (`services/vetsorcery.ts`) was corrected on 2026-08-04; this copy was missed.
  //
  // Resolution order mirrors that fix: server-set claim first (canonical, forgery
  // -proof, no Firestore read), then the user doc, then the clinic record.
  if (await hasPaidSubscription(userId)) return true;

  // 2. CPD Pass — active and (if time-boxed) not expired.
  const entSnap = await adminDb.collection('cpd_entitlements').doc(userId).get();
  if (!entSnap.exists) return false;
  const e = entSnap.data() || {};
  if (e.active !== true) return false;
  if (e.expires_at && new Date(e.expires_at).getTime() < Date.now()) return false;
  return true;
}

/**
 * Grant / renew a CPD Pass. Called from the Stripe webhook after a verified
 * `checkout.session.completed`. Idempotent (merge). `expiresAt` sets a renewal
 * horizon for subscription passes; omit for a lifetime one-off pass.
 */
export async function grantCpdEntitlement(userId: string, meta: GrantMeta = { source: 'unknown' }): Promise<void> {
  if (!userId) throw new Error('grantCpdEntitlement: missing userId');
  await adminDb.collection('cpd_entitlements').doc(userId).set(
    {
      active: true,
      plan: meta.plan || 'all_access',
      granted_at: new Date().toISOString(),
      expires_at: meta.expiresAt ?? null,
      source: meta.source,
      ...(meta.stripeSessionId ? { stripe_session_id: meta.stripeSessionId } : {}),
      ...(meta.stripeCustomerId ? { stripe_customer_id: meta.stripeCustomerId } : {}),
      ...(meta.email ? { email: meta.email } : {})
    },
    { merge: true }
  );
}

/**
 * Revoke a CPD Pass (refund or subscription cancellation). Idempotent.
 */
export async function revokeCpdEntitlement(userId: string, reason: string): Promise<void> {
  if (!userId) return;
  await adminDb
    .collection('cpd_entitlements')
    .doc(userId)
    .set({ active: false, revoked_at: new Date().toISOString(), revoke_reason: reason }, { merge: true });
}
