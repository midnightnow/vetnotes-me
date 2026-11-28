import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeFirestore } from '$lib/server/pro_billing.testkit';

const h = vi.hoisted(() => ({ db: null as any, claims: {} as Record<string, unknown> }));

vi.mock('$lib/server/firebase-admin', () => ({
	adminDb: {
		collection: (c: string) => h.db.collection(c),
		runTransaction: (fn: any) => h.db.runTransaction(fn)
	},
	adminAuth: { getUser: async () => ({ customClaims: h.claims }) },
	FieldValue: { serverTimestamp: () => 'SERVER_TS' }
}));

import { GET } from './+server';

const call = async (user?: { uid: string }) => (await (GET as any)({ locals: { user } })).json();

describe('GET /api/pro/status', () => {
	beforeEach(() => {
		h.db = fakeFirestore();
		h.claims = {};
	});

	it('reports a signed-out caller as not Pro and not manageable', async () => {
		expect(await call()).toEqual({ pro: false, authenticated: false, manageable: false });
	});

	it('a signed-in vet with no entitlement is not Pro', async () => {
		expect(await call({ uid: 'u1' })).toEqual({ pro: false, authenticated: true, manageable: false });
	});

	it('a vet with an active VetNotes Pro grant and a stored customer can manage it', async () => {
		h.db = fakeFirestore({
			'vetnotes_pro_entitlements/u1': { active: true, stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' }
		});
		expect(await call({ uid: 'u1' })).toEqual({ pro: true, authenticated: true, manageable: true });
	});

	it('Pro through a paid VetSorcery plan is Pro but has nothing to manage here', async () => {
		h.claims = { plan: 'professional' };
		expect(await call({ uid: 'u1' })).toEqual({ pro: true, authenticated: true, manageable: false });
	});

	it('a stored customer alone (checkout started, never paid) is neither Pro nor manageable', async () => {
		h.db = fakeFirestore({ 'vetnotes_pro_billing/u1': { stripe_customer_id: 'cus_1' } });
		expect(await call({ uid: 'u1' })).toEqual({ pro: false, authenticated: true, manageable: false });
	});

	it('a revoked grant is not manageable from the pricing page', async () => {
		h.db = fakeFirestore({ 'vetnotes_pro_entitlements/u1': { active: false, stripe_customer_id: 'cus_1' } });
		expect(await call({ uid: 'u1' })).toEqual({ pro: false, authenticated: true, manageable: false });
	});
});
