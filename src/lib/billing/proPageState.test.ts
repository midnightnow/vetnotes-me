import { describe, it, expect } from 'vitest';
import { accountFromStatus, proPageView, type ProAccount, type ProPageInput } from './proPageState';

const base: ProPageInput = {
	paidFlag: false,
	cancelledFlag: false,
	account: 'free',
	manageable: false,
	recheckExhausted: false
};
const view = (over: Partial<ProPageInput>) => proPageView({ ...base, ...over });

describe('proPageView — the page decides from the entitlement, not the URL', () => {
	it('?pro_paid=1 on an unpaid account never says active', () => {
		const accounts: ProAccount[] = ['loading', 'signed_out', 'free', 'unknown'];
		for (const account of accounts) {
			for (const recheckExhausted of [false, true]) {
				for (const manageable of [false, true]) {
					const v = view({ paidFlag: true, account, recheckExhausted, manageable });
					expect(v.notice, `${account}/${recheckExhausted}/${manageable}`).not.toBe('active');
					expect(v.cta).not.toBe('manage');
				}
			}
		}
	});

	it('says "payment received" only once the server reports the vet\'s own Pro subscription', () => {
		expect(view({ paidFlag: true, account: 'pro', manageable: true })).toMatchObject({
			notice: 'active',
			cta: 'manage',
			shouldRecheck: false
		});
	});

	it('shows nothing about a payment when the flag is absent', () => {
		expect(view({ account: 'pro', manageable: true }).notice).toBeNull();
		expect(view({ account: 'free' }).notice).toBeNull();
	});

	it('back from Stripe before the webhook has landed: an honest "confirming" state that re-checks', () => {
		expect(view({ paidFlag: true, account: 'free' })).toMatchObject({
			notice: 'confirming',
			shouldRecheck: true
		});
		expect(view({ paidFlag: true, account: 'unknown' })).toMatchObject({
			notice: 'confirming',
			shouldRecheck: true
		});
	});

	it('stops re-checking and says so plainly when the payment cannot be confirmed', () => {
		expect(view({ paidFlag: true, account: 'free', recheckExhausted: true })).toMatchObject({
			notice: 'unconfirmed',
			shouldRecheck: false
		});
	});

	it('while "confirming", Subscribe is held back so a vet who just paid cannot pay again', () => {
		expect(view({ paidFlag: true, account: 'free' }).cta).toBe('checking');
		// Once re-checking has given up the vet may try again; the server still refuses a second subscription.
		expect(view({ paidFlag: true, account: 'free', recheckExhausted: true }).cta).toBe('subscribe');
	});

	it('asks a signed-out visitor to sign in rather than guessing', () => {
		expect(view({ paidFlag: true, account: 'signed_out' })).toMatchObject({
			notice: 'sign_in_to_confirm',
			cta: 'subscribe',
			shouldRecheck: false
		});
	});

	it('Pro through a VetSorcery plan plus a typed ?pro_paid=1 does not claim a payment', () => {
		expect(view({ paidFlag: true, account: 'pro', manageable: false })).toMatchObject({
			notice: null,
			cta: 'included'
		});
	});
});

describe('proPageView — the Pro card', () => {
	it('hides Subscribe for a vet who already has Pro', () => {
		expect(view({ account: 'pro', manageable: true }).cta).toBe('manage');
		expect(view({ account: 'pro', manageable: false }).cta).toBe('included');
	});

	it('offers Subscribe to free and signed-out visitors, and when the status is unknown', () => {
		expect(view({ account: 'free' }).cta).toBe('subscribe');
		expect(view({ account: 'signed_out' }).cta).toBe('subscribe');
		expect(view({ account: 'unknown' }).cta).toBe('subscribe');
	});

	it('shows neither Subscribe nor Manage until the server has answered', () => {
		expect(view({ account: 'loading' }).cta).toBe('checking');
		expect(view({ paidFlag: true, account: 'loading' }).notice).toBe('checking');
	});

	it('notes an abandoned checkout, unless the vet has Pro anyway', () => {
		expect(view({ cancelledFlag: true, account: 'free' }).notice).toBe('cancelled');
		expect(view({ cancelledFlag: true, account: 'pro', manageable: true }).notice).toBeNull();
	});
});

describe('accountFromStatus', () => {
	it('maps the server reply', () => {
		expect(accountFromStatus(undefined)).toBe('loading');
		expect(accountFromStatus(null)).toBe('unknown');
		expect(accountFromStatus({ pro: false, authenticated: false, manageable: false })).toBe('signed_out');
		expect(accountFromStatus({ pro: false, authenticated: true, manageable: false })).toBe('free');
		expect(accountFromStatus({ pro: true, authenticated: true, manageable: true })).toBe('pro');
	});
});
