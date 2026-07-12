/**
 * Stripe webhook for CPD certification purchases.
 *
 * On a signature-verified `checkout.session.completed` for the CPD product,
 * grants the buyer a CPD entitlement (idempotent). Signature verification is
 * done manually against the raw body (no `stripe` npm dependency).
 *
 * Required env:
 *   STRIPE_CPD_WEBHOOK_SECRET — the signing secret (whsec_...) for this endpoint
 *
 * Point a Stripe webhook at POST /api/cpd/webhook, event: checkout.session.completed.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import crypto from 'node:crypto';
import { grantCpdEntitlement } from '$lib/server/cpd_entitlement';

const TOLERANCE_SECONDS = 300;

function verifyStripeSignature(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=')));
  const timestamp = parts['t'];
  const signature = parts['v1'];
  if (!timestamp || !signature) return false;

  // Reject stale timestamps to blunt replay attacks.
  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (!Number.isFinite(age) || Math.abs(age) > TOLERANCE_SECONDS) return false;

  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const POST: RequestHandler = async ({ request }) => {
  const secret = env.STRIPE_CPD_WEBHOOK_SECRET;
  if (!secret) {
    return json({ received: false, configured: false }, { status: 503 });
  }

  // Raw body is required for signature verification — do not parse first.
  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get('stripe-signature'), secret)) {
    throw error(400, 'Invalid Stripe signature');
  }

  const event = JSON.parse(payload);
  if (event.type === 'checkout.session.completed') {
    const session = event.data?.object || {};
    const userId = session.client_reference_id || session.metadata?.user_id;
    const product = session.metadata?.product;
    if (userId && product === 'cpd_certification') {
      await grantCpdEntitlement(userId, {
        source: 'stripe_checkout',
        stripeSessionId: session.id,
        email: session.customer_details?.email || session.customer_email
      });
    }
  }

  // Always 200 quickly so Stripe doesn't retry a handled event.
  return json({ received: true });
};
