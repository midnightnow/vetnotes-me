/**
 * Browser-side calls to the VetNotes Pro billing routes.
 *
 * Every answer that matters comes from the server, which decides from the
 * verified sign-in: these helpers send no user id, customer id or plan.
 */
import { auth } from '$lib/firebase';

export interface ProStatus {
	pro: boolean;
	authenticated: boolean;
	/** The vet has their own VetNotes Pro subscription, so the billing portal will open. */
	manageable: boolean;
}

/**
 * `fetch` for the billing routes, as the signed-in user.
 *
 * The server accepts the `__session` cookie or a bearer ID token. The cookie is
 * written a moment after Firebase restores the sign-in, so a request made as the
 * page loads (for example, straight back from Stripe) can beat it. Waiting for
 * the auth state and sending the token as well closes that gap.
 */
export async function billingFetch(path: string, init: RequestInit = {}): Promise<Response> {
	const headers = new Headers(init.headers);
	try {
		await auth.authStateReady();
		const user = auth.currentUser;
		if (user) headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
	} catch {
		/* Fall back to the session cookie alone. */
	}
	return fetch(path, { ...init, headers });
}

/** The caller's Pro status, or null when it could not be read. */
export async function fetchProStatus(): Promise<ProStatus | null> {
	try {
		const res = await billingFetch('/api/pro/status');
		if (!res.ok) return null;
		const data = await res.json();
		return {
			pro: data?.pro === true,
			authenticated: data?.authenticated === true,
			manageable: data?.manageable === true
		};
	} catch {
		return null;
	}
}

export type PortalResult =
	| { ok: true; url: string }
	| { ok: false; reason: 'signed_out' | 'no_billing_account' | 'unavailable'; message: string };

/** Ask the server for a Stripe Billing Portal link for the signed-in vet. */
export async function requestBillingPortal(): Promise<PortalResult> {
	const unavailable: PortalResult = {
		ok: false,
		reason: 'unavailable',
		message: 'Subscription management is not available right now. Please try again shortly, or open a support ticket.'
	};
	try {
		const res = await billingFetch('/api/pro/portal', { method: 'POST' });
		if (res.status === 401) {
			return { ok: false, reason: 'signed_out', message: 'Sign in to manage your subscription.' };
		}
		const data = await res.json().catch(() => ({}));
		if (res.ok && typeof data?.url === 'string' && data.url) return { ok: true, url: data.url };
		if (res.status === 404 && data?.code === 'no_billing_account') {
			return {
				ok: false,
				reason: 'no_billing_account',
				message:
					'There is no VetNotes Pro billing account for this sign-in. If you subscribed with a different sign-in, use that one.'
			};
		}
		return unavailable;
	} catch {
		return unavailable;
	}
}
