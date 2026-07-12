/**
 * CPD Entitlement (server authority)
 *
 * A user may retrieve a *verifiable* CPD certificate when they are entitled.
 * Entitlement is granted by EITHER:
 *   1. An active paid subscription tier on their `users/{uid}` profile
 *      (pro / enterprise / starter) — CPD certification is bundled into Pro.
 *   2. A one-off CPD purchase recorded in `cpd_entitlements/{uid}` (active).
 *
 * Learning and scoring stay free for everyone. This gate only controls
 * issuance of the accreditation artifact ("pay to certify").
 */
import { adminDb } from '$lib/server/firebase-admin';

const PAID_TIERS = new Set(['pro', 'enterprise', 'starter']);

export async function hasCpdEntitlement(userId: string): Promise<boolean> {
  if (!userId) return false;

  // 1. Bundled with a paid subscription tier.
  const userSnap = await adminDb.collection('users').doc(userId).get();
  if (userSnap.exists) {
    const data = userSnap.data() || {};
    const tier = (data.subscription?.tier || data.subscriptionTier || 'free') as string;
    if (PAID_TIERS.has(tier)) return true;
  }

  // 2. One-off CPD purchase.
  const entSnap = await adminDb.collection('cpd_entitlements').doc(userId).get();
  if (entSnap.exists && entSnap.data()?.active === true) return true;

  return false;
}

/**
 * Grant a one-off CPD entitlement. Called from the Stripe webhook after a
 * verified `checkout.session.completed` for the CPD product. Idempotent.
 */
export async function grantCpdEntitlement(
  userId: string,
  meta: { source: string; stripeSessionId?: string; email?: string } = { source: 'unknown' }
): Promise<void> {
  if (!userId) throw new Error('grantCpdEntitlement: missing userId');
  await adminDb.collection('cpd_entitlements').doc(userId).set(
    {
      active: true,
      granted_at: new Date().toISOString(),
      ...meta
    },
    { merge: true }
  );
}
