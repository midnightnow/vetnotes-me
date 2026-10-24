/**
 * Server-side SOAP structuring on Vertex AI.
 *
 * WHY THIS EXISTS
 * ---------------
 * Until 2026-10-24 "Cloud SOAP structuring" (sold in VetNotes Basic/Pro) ran in
 * the browser with `VITE_GEMINI_API_KEY` against `gemini-1.5-flash`. The key was
 * never baked into the production bundle and that model is retired, so every
 * note silently fell back to keyword rules while the UI said "Local AI".
 *
 * This runs on the Cloud Run service with its own service account (no key in
 * any bundle). It needs `roles/aiplatform.user` on the Vertex project
 * (`VERTEX_PROJECT`, default `vetsorcery`, where Vertex is enabled). Without it
 * Vertex answers 403 and the route reports `configured: false` — the client then
 * falls back to local structuring and says so.
 */
import { applicationDefault } from 'firebase-admin/app';
import type { SOAPNote } from '$lib/types';
import { buildSoapPrompt, parseSoapJson, SOAP_FALLBACK_MODELS, SOAP_PRIMARY_MODEL } from '$lib/soapPrompt';

export class VertexNotConfiguredError extends Error {}

/** Status codes worth trying the next model for (capacity, retirement). */
const RETRYABLE = new Set([404, 429, 500, 502, 503, 504]);

export function modelChain(primary = process.env.VETNOTES_SOAP_MODEL || SOAP_PRIMARY_MODEL): string[] {
	const chain: string[] = [];
	for (const m of [primary, SOAP_PRIMARY_MODEL, ...SOAP_FALLBACK_MODELS]) {
		if (m && !chain.includes(m)) chain.push(m);
	}
	return chain;
}

function vertexUrl(model: string): string {
	const project = process.env.VERTEX_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'vetsorcery';
	return `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${model}:generateContent`;
}

async function accessToken(): Promise<string> {
	try {
		const { access_token } = await applicationDefault().getAccessToken();
		if (!access_token) throw new Error('empty access token');
		return access_token;
	} catch (err) {
		throw new VertexNotConfiguredError(`no service credentials: ${(err as Error).message}`);
	}
}

export interface StructureResult {
	note: SOAPNote;
	model: string;
}

/** Structure a (PII-redacted) transcript. `fetchImpl` is injectable for tests. */
export async function structureTranscript(
	transcript: string,
	fetchImpl: typeof fetch = fetch,
	getToken: () => Promise<string> = accessToken
): Promise<StructureResult> {
	const token = await getToken();
	const body = JSON.stringify({
		contents: [{ role: 'user', parts: [{ text: buildSoapPrompt(transcript) }] }],
		generationConfig: { temperature: 0.3, responseMimeType: 'application/json' }
	});

	let lastError = 'no model attempted';
	for (const model of modelChain()) {
		let res: Response;
		try {
			res = await fetchImpl(vertexUrl(model), {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body,
				signal: AbortSignal.timeout(20_000)
			});
		} catch (err) {
			lastError = `${model}: ${(err as Error).message}`;
			continue;
		}
		if (res.status === 401 || res.status === 403) {
			throw new VertexNotConfiguredError(`Vertex refused the service account (${res.status})`);
		}
		if (!res.ok) {
			lastError = `${model}: HTTP ${res.status}`;
			if (RETRYABLE.has(res.status)) continue;
			break;
		}
		const data = (await res.json()) as {
			candidates?: { content?: { parts?: { text?: string }[] } }[];
		};
		const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
		if (!text.trim()) {
			lastError = `${model}: empty reply`;
			continue;
		}
		try {
			return { note: parseSoapJson(text), model };
		} catch (err) {
			lastError = `${model}: ${(err as Error).message}`;
			continue;
		}
	}
	throw new Error(`SOAP structuring failed (${lastError})`);
}
