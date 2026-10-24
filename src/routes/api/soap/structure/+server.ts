/**
 * Cloud SOAP structuring — the feature VetNotes Basic/Pro sell.
 *
 * Signed-in and entitled users only (`hasProEntitlement`: a paid VetSorcery plan
 * or a VetNotes Pro entitlement). The client redacts PII before calling.
 *
 * Responses:
 *   200 { success, soap, model }
 *   401 not signed in · 403 { pro: false } not entitled · 400 bad transcript
 *   429 per-user rate limit · 502 every model failed
 *   503 { configured: false } service account cannot reach Vertex (see
 *       `server/soap_structurer.ts`) — the client falls back to local rules.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasProEntitlement } from '$lib/server/pro_entitlement';
import { structureTranscript, VertexNotConfiguredError } from '$lib/server/soap_structurer';
import { MAX_TRANSCRIPT_CHARS } from '$lib/soapPrompt';

/* Per-instance limiter: bounds a runaway client, not a determined abuser (Cloud
   Run can scale out). Entitlement is the real gate. */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const calls = new Map<string, { count: number; resetAt: number }>();

function overLimit(uid: string, now = Date.now()): boolean {
	const entry = calls.get(uid);
	if (!entry || now > entry.resetAt) {
		calls.set(uid, { count: 1, resetAt: now + WINDOW_MS });
		if (calls.size > 5000) {
			for (const [k, v] of calls) if (now > v.resetAt) calls.delete(k);
		}
		return false;
	}
	entry.count++;
	return entry.count > MAX_PER_WINDOW;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const body = await request.json().catch(() => ({}));
	const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : '';
	if (!transcript) return json({ success: false, error: 'transcript required' }, { status: 400 });
	if (transcript.length > MAX_TRANSCRIPT_CHARS) {
		return json({ success: false, error: `transcript longer than ${MAX_TRANSCRIPT_CHARS} characters` }, { status: 400 });
	}

	if (!(await hasProEntitlement(locals.user.uid))) {
		return json({ success: false, pro: false, error: 'Cloud structuring is part of VetNotes Pro.' }, { status: 403 });
	}
	if (overLimit(locals.user.uid)) {
		return json({ success: false, error: 'Too many requests — try again in a few minutes.' }, { status: 429 });
	}

	try {
		const { note, model } = await structureTranscript(transcript);
		return json({ success: true, soap: note, model });
	} catch (err) {
		if (err instanceof VertexNotConfiguredError) {
			console.error('[soap/structure] Vertex not configured:', err.message);
			return json(
				{ success: false, configured: false, error: 'Cloud structuring is not available yet.' },
				{ status: 503 }
			);
		}
		console.error('[soap/structure] failed:', (err as Error).message);
		return json({ success: false, error: 'Cloud structuring failed.' }, { status: 502 });
	}
};
