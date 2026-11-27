/**
 * Renders the real pricing page in jsdom. The server calls are replaced, so
 * nothing here reaches Firebase or Stripe.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';

type Status = { pro: boolean; authenticated: boolean; manageable: boolean } | null;
const h = vi.hoisted(() => ({ status: null as Status }));

vi.mock('$lib/billing/proClient', () => ({
	fetchProStatus: vi.fn(async () => h.status),
	billingFetch: vi.fn(),
	requestBillingPortal: vi.fn()
}));

import Page from './+page.svelte';
import { RECHECK_INTERVAL_MS, RECHECK_MAX_ATTEMPTS } from '$lib/billing/proPageState';

const FREE: Status = { pro: false, authenticated: true, manageable: false };
const PRO: Status = { pro: true, authenticated: true, manageable: true };
const SIGNED_OUT: Status = { pro: false, authenticated: false, manageable: false };

let app: ReturnType<typeof mount> | null = null;
let target: HTMLElement;

async function settle() {
	await vi.advanceTimersByTimeAsync(0);
	flushSync();
}

async function render(search: string) {
	window.history.replaceState({}, '', `/pricing${search}`);
	target = document.createElement('div');
	document.body.appendChild(target);
	app = mount(Page, { target });
	await settle();
}

const text = () => (target.textContent || '').replace(/\s+/g, ' ');
const has = (testId: string) => !!target.querySelector(`[data-testid="${testId}"]`);

describe('pricing page — Pro', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		h.status = FREE;
	});
	afterEach(() => {
		if (app) unmount(app);
		app = null;
		document.body.innerHTML = '';
		vi.useRealTimers();
	});

	it('?pro_paid=1 on an unpaid account does not say active, and holds Subscribe back', async () => {
		await render('?pro_paid=1');
		expect(text()).not.toContain('Pro is active on this account');
		expect(text()).not.toContain('Payment received');
		expect(has('pro-notice-confirming')).toBe(true);
		expect(text()).toContain('Pro is not active on this account yet');
		expect(has('pro-subscribe')).toBe(false);
		expect(has('manage-subscription')).toBe(false);
	});

	it('?pro_paid=1 once the entitlement has landed: payment received, Manage subscription, no Subscribe', async () => {
		h.status = PRO;
		await render('?pro_paid=1');
		expect(text()).toContain('Payment received. Pro is active on this account.');
		expect(has('manage-subscription')).toBe(true);
		expect(has('pro-subscribe')).toBe(false);
	});

	it('re-checks while confirming and switches to active when the webhook lands', async () => {
		await render('?pro_paid=1');
		expect(has('pro-notice-confirming')).toBe(true);

		h.status = PRO;
		await vi.advanceTimersByTimeAsync(RECHECK_INTERVAL_MS);
		flushSync();
		expect(has('pro-notice-active')).toBe(true);
		expect(has('pro-notice-confirming')).toBe(false);
		expect(has('manage-subscription')).toBe(true);
	});

	it('gives up honestly when the payment never confirms, and never says active', async () => {
		await render('?pro_paid=1');
		await vi.advanceTimersByTimeAsync(RECHECK_INTERVAL_MS * (RECHECK_MAX_ATTEMPTS + 1));
		flushSync();
		expect(has('pro-notice-unconfirmed')).toBe(true);
		expect(text()).not.toContain('Payment received');
		expect(text()).toContain('please do not pay again');
	});

	it('a signed-out visitor with ?pro_paid=1 is asked to sign in', async () => {
		h.status = SIGNED_OUT;
		await render('?pro_paid=1');
		expect(text()).toContain('to see whether Pro is active on your account');
		expect(text()).not.toContain('Payment received');
	});

	it('a vet who already has Pro sees Manage subscription instead of Subscribe', async () => {
		h.status = PRO;
		await render('');
		expect(has('manage-subscription')).toBe(true);
		expect(has('pro-subscribe')).toBe(false);
		expect(has('pro-active')).toBe(true);
		expect(text()).not.toContain('Payment received');
	});

	it('Pro through another plan: neither Subscribe nor Manage', async () => {
		h.status = { pro: true, authenticated: true, manageable: false };
		await render('');
		expect(has('pro-included')).toBe(true);
		expect(has('pro-subscribe')).toBe(false);
		expect(has('manage-subscription')).toBe(false);
	});

	it('a vet without Pro sees Subscribe and no Manage subscription', async () => {
		await render('');
		expect(has('pro-subscribe')).toBe(true);
		expect(has('manage-subscription')).toBe(false);
	});

	it('still offers Subscribe when the status cannot be read (the server refuses a second subscription)', async () => {
		h.status = null;
		await render('');
		expect(has('pro-subscribe')).toBe(true);
	});
});
