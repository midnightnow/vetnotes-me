/**
 * Paid-state vocabulary — the SINGLE definition for this repo.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * VetSorcery's `stripeWebhook.ts` is the only writer of paid state. It sets a
 * server-side `plan` custom auth claim (and mirrors it to `users/{uid}.plan` and
 * `clinics/{id}.subscription.plan`). Every consumer must read THAT signal.
 *
 * Two consumers in this repo drifted apart and the drift was invisible:
 *
 *   - `src/lib/services/vetsorcery.ts` (client feature gate) was fixed on
 *     2026-08-04 to read the `plan` claim.
 *   - `src/lib/server/cpd_entitlement.ts` (server certificate gate) was NOT, and
 *     kept reading `users/{uid}.subscription.tier` — a field NOTHING has ever
 *     written. It therefore resolved every practitioner to `free`, so a clinic on
 *     a paid VetSorcery plan passed a CPD case and was still shown a paywall.
 *
 * The lists below were previously duplicated as private consts with a comment
 * asking humans to keep them in sync. That is exactly the class of defect this
 * codebase keeps reproducing: a contract asserted in prose and enforced by
 * nobody. Import from here; do not redeclare.
 *
 * Upstream canonical definition:
 * `apps/vetsorcery-core/frontend/src/lib/subscription.ts` (`PAYING_PLANS`).
 * `internal_test` is the $1 admin billing probe — a real Stripe charge.
 */

/** Plans that represent an actual paid subscription. */
export const PAYING_PLANS: ReadonlySet<string> = new Set([
	'solo_dental',
	'starter',
	'professional',
	'pro',
	'enterprise',
	'internal_test'
]);

/** Subscription statuses where access is no longer paid for. */
export const DEAD_STATUSES: ReadonlySet<string> = new Set(['cancelled', 'payment_failed']);

/**
 * Is this (plan, status) pair currently paid?
 *
 * Central so the client gate and the server gate cannot answer differently.
 */
export function isPaidPlan(plan: unknown, status?: unknown): boolean {
	if (typeof plan !== 'string' || !PAYING_PLANS.has(plan)) return false;
	if (typeof status === 'string' && DEAD_STATUSES.has(status)) return false;
	return true;
}
