/**
 * CPD checkout — creates a Stripe Checkout Session for CPD certification.
 *
 * Uses the Stripe REST API directly (no `stripe` npm dependency) to avoid
 * adding a package + build risk to the live app. Reuses the existing Stripe
 * account via env config; provisioning the product/price and secrets is an
 * operational step (see below), not code.
 *
 * Required env (set in the deploy environment / Firebase Functions config):
 *   STRIPE_SECRET_KEY  — the live/test secret key of the existing account
 *   CPD_PRICE_ID       — a Stripe Price ID for the CPD product (one-off or recurring)
 * Optional:
 *   CPD_CHECKOUT_MODE  — 'payment' (default, one-off) or 'subscription'
 *
 * If unconfigured, responds 503 with { configured: false } so the UI can show
 * a graceful "certification coming soon" state instead of erroring.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

const STRIPE_API = 'https://api.stripe.com/v1/checkout/sessions';

export const POST: RequestHandler = async ({ request, locals, url }) => {
  if (!locals.user) throw error(401, 'Unauthorized');

  const secret = env.STRIPE_SECRET_KEY;
  const priceId = env.CPD_PRICE_ID;
  if (!secret || !priceId) {
    return json(
      { success: false, configured: false, error: 'CPD certification checkout is not yet configured.' },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const returnPath = typeof body.return_path === 'string' && body.return_path.startsWith('/') ? body.return_path : '/cpd';
  const mode = env.CPD_CHECKOUT_MODE === 'subscription' ? 'subscription' : 'payment';

  // All-access CPD Pass: one purchase unlocks certificates on every case.
  const form = new URLSearchParams();
  form.set('mode', mode);
  form.set('line_items[0][price]', priceId);
  form.set('line_items[0][quantity]', '1');
  form.set('client_reference_id', locals.user.uid);
  form.set('metadata[user_id]', locals.user.uid);
  form.set('metadata[product]', 'cpd_pass');
  form.set('metadata[plan]', 'all_access');
  // Propagate metadata onto the subscription too, so renewal/cancel events map back.
  if (mode === 'subscription') {
    form.set('subscription_data[metadata][user_id]', locals.user.uid);
    form.set('subscription_data[metadata][product]', 'cpd_pass');
  }
  if (locals.user.email) form.set('customer_email', locals.user.email);
  form.set('success_url', `${url.origin}${returnPath}?cpd_paid=1`);
  form.set('cancel_url', `${url.origin}${returnPath}?cpd_cancelled=1`);

  const res = await fetch(STRIPE_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form.toString()
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('CPD checkout: Stripe session creation failed', res.status, detail);
    throw error(502, 'Unable to start CPD checkout. Please try again.');
  }

  const session = (await res.json()) as { id: string; url: string };
  return json({ success: true, url: session.url, sessionId: session.id });
};
