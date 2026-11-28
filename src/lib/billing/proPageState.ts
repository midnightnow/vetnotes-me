/**
 * What the pricing page shows for VetNotes Pro. Pure, so it can be tested.
 *
 * THE RULE: the page decides from the entitlement the SERVER reports
 * (`/api/pro/status`), never from the URL. Stripe sends a buyer back to
 * `/pricing?pro_paid=1`, but anyone can type that address. The flag only says
 * "this visitor may be waiting on a payment"; it never says "paid". So:
 *
 *   - "Payment received. Pro is active" needs the server to report the vet's
 *     own live Pro subscription.
 *   - The flag on an account the server says is not Pro shows "confirming"
 *     (the webhook may not have landed yet) and re-checks, then gives up
 *     honestly. It never shows "active".
 */
import type { ProStatus } from './proClient';

/** `unknown`: the status request failed, so we cannot tell. */
export type ProAccount = 'loading' | 'signed_out' | 'free' | 'pro' | 'unknown';

export interface ProPageInput {
	/** `?pro_paid=1` is in the URL (Stripe's success redirect). */
	paidFlag: boolean;
	/** `?pro_cancelled=1` is in the URL (the buyer backed out of Stripe Checkout). */
	cancelledFlag: boolean;
	account: ProAccount;
	/** Server: the vet has their own VetNotes Pro subscription the portal can open. */
	manageable: boolean;
	/** The page has re-checked the status as many times as it is going to. */
	recheckExhausted: boolean;
}

export type ProNotice =
	/** Server confirms the vet's own Pro subscription after a checkout. */
	| 'active'
	/** Waiting for the first status reply. */
	| 'checking'
	/** Back from Stripe; the entitlement has not landed yet; re-checking. */
	| 'confirming'
	/** Re-checked and still not Pro. */
	| 'unconfirmed'
	/** Back from Stripe but not signed in, so nothing can be confirmed. */
	| 'sign_in_to_confirm'
	/** The buyer left Stripe Checkout without paying. */
	| 'cancelled'
	| null;

export type ProCta =
	/** Status not known yet (or a payment is being confirmed): no button to press. */
	| 'checking'
	| 'subscribe'
	/** Has their own Pro subscription: show Manage subscription, not Subscribe. */
	| 'manage'
	/** Has Pro some other way (a paid VetSorcery plan): nothing to buy or manage here. */
	| 'included';

export interface ProPageView {
	notice: ProNotice;
	cta: ProCta;
	/** The page should ask the server for the status again shortly. */
	shouldRecheck: boolean;
}

/** `undefined` = no reply yet, `null` = the request failed. */
export function accountFromStatus(status: ProStatus | null | undefined): ProAccount {
	if (status === undefined) return 'loading';
	if (status === null) return 'unknown';
	if (status.pro) return 'pro';
	return status.authenticated ? 'free' : 'signed_out';
}

export function proPageView(input: ProPageInput): ProPageView {
	const { paidFlag, cancelledFlag, account, recheckExhausted } = input;
	const isPro = account === 'pro';
	// `manageable` only means something when the server also says Pro.
	const ownSubscription = isPro && input.manageable;

	const awaitingPayment = paidFlag && (account === 'free' || account === 'unknown');
	const shouldRecheck = awaitingPayment && !recheckExhausted;

	let notice: ProNotice = null;
	if (paidFlag) {
		if (ownSubscription) notice = 'active';
		else if (account === 'loading') notice = 'checking';
		else if (account === 'signed_out') notice = 'sign_in_to_confirm';
		else if (awaitingPayment) notice = recheckExhausted ? 'unconfirmed' : 'confirming';
	} else if (cancelledFlag && !isPro && account !== 'loading') {
		notice = 'cancelled';
	}

	let cta: ProCta;
	if (ownSubscription) cta = 'manage';
	else if (isPro) cta = 'included';
	else if (account === 'loading' || shouldRecheck) cta = 'checking';
	else cta = 'subscribe';

	return { notice, cta, shouldRecheck };
}

/** How often and how many times the pricing page re-checks after `?pro_paid=1`. */
export const RECHECK_INTERVAL_MS = 3000;
export const RECHECK_MAX_ATTEMPTS = 20;
