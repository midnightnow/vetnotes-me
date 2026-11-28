/**
 * Test doubles for the VetNotes Pro billing routes. Imported by tests only.
 *
 * Nothing here talks to Stripe or Firestore: the Firestore double is an
 * in-memory map and the Stripe double is a `fetch` replacement that throws on
 * any URL it was not told about, so a test can never reach the live API.
 */

type Doc = Record<string, unknown>;

/** Minimal in-memory Firestore: collection().doc().get/set and runTransaction. */
export function fakeFirestore(seed: Record<string, Doc> = {}) {
	const docs = new Map<string, Doc>(Object.entries(seed));
	const ref = (collection: string, id: string) => {
		const path = `${collection}/${id}`;
		return {
			path,
			get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }),
			set: async (data: Doc, opts?: { merge?: boolean }) => {
				docs.set(path, opts?.merge ? { ...(docs.get(path) || {}), ...data } : { ...data });
			}
		};
	};
	return {
		docs,
		collection: (collection: string) => ({ doc: (id: string) => ref(collection, id) }),
		runTransaction: async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
			const writes: (() => Promise<void>)[] = [];
			const tx = {
				get: (r: ReturnType<typeof ref>) => r.get(),
				set: (r: ReturnType<typeof ref>, data: Doc, opts?: { merge?: boolean }) => {
					writes.push(() => r.set(data, opts));
				}
			};
			const out = await fn(tx);
			for (const w of writes) await w();
			return out;
		}
	};
}

export interface StripeCall {
	method: string;
	/** Path after `/v1/`, without the query string. */
	path: string;
	query: URLSearchParams;
	form: URLSearchParams;
	headers: Record<string, string>;
}

type Reply = { status?: number; body?: unknown };
type Handler = (call: StripeCall) => Reply | undefined;

/**
 * A `fetch` stand-in for `https://api.stripe.com/v1/*`.
 * `routes` maps "METHOD path" to a reply (or a function of the call).
 */
export function fakeStripe(routes: Record<string, Reply | Handler>) {
	const calls: StripeCall[] = [];
	const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
		if (url.origin !== 'https://api.stripe.com' || !url.pathname.startsWith('/v1/')) {
			throw new Error(`fakeStripe: unexpected request to ${url.origin}${url.pathname}`);
		}
		const method = (init?.method || 'GET').toUpperCase();
		const call: StripeCall = {
			method,
			path: url.pathname.slice('/v1/'.length),
			query: url.searchParams,
			form: new URLSearchParams(typeof init?.body === 'string' ? init.body : ''),
			headers: Object.fromEntries(new Headers(init?.headers).entries())
		};
		calls.push(call);
		const route = routes[`${method} ${call.path}`];
		if (!route) throw new Error(`fakeStripe: no route for ${method} ${call.path}`);
		const reply = (typeof route === 'function' ? route(call) : route) || {};
		return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status ?? 200 });
	}) as unknown as typeof fetch;
	return { calls, fetchImpl };
}
