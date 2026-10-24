import { describe, it, expect } from 'vitest';
import { modelChain, structureTranscript, VertexNotConfiguredError } from './soap_structurer';
import { AIVA_SYSTEM_PROMPT, parseSoapJson, SOAP_PRIMARY_MODEL } from '$lib/soapPrompt';

const SOAP = {
	subjective: 'Itchy ears 3 days',
	objective: 'Otic: erythema AD. Vitals: Not narrated',
	assessment: 'Otitis externa',
	plan: 'Ear cytology; otic drops BID 10 days',
	missedCharges: ['Ear Cytology', '  ', 42]
};

function reply(status: number, body?: unknown): Response {
	return new Response(body === undefined ? '' : JSON.stringify(body), { status });
}

function vertexOk(text: string): Response {
	return reply(200, { candidates: [{ content: { parts: [{ text }] } }] });
}

const token = async () => 'test-token';

describe('SOAP prompt — never invent a normal exam', () => {
	it('drops the old "infer a normal exam" instruction', () => {
		// The prompt used to tell the model to turn "looks healthy" into
		// "General physical exam: No abnormalities detected on systems examined."
		expect(AIVA_SYSTEM_PROMPT).not.toMatch(/No abnormalities detected/i);
		expect(AIVA_SYSTEM_PROMPT).not.toMatch(/INFERENCE OVER EXTRACTION/);
		expect(AIVA_SYSTEM_PROMPT).toMatch(/Never write a finding the vet did not state/);
	});

	it('pins a current model, not the retired gemini-1.5-flash', () => {
		expect(SOAP_PRIMARY_MODEL).not.toMatch(/1\.5/);
		expect(modelChain()).toEqual(['gemini-3.6-flash', 'gemini-3.8-flash']);
		expect(modelChain('gemini-3.6-flash')).toEqual(['gemini-3.6-flash', 'gemini-3.8-flash']);
	});
});

describe('parseSoapJson', () => {
	it('strips code fences, keeps only non-empty string charges', () => {
		const note = parseSoapJson('```json\n' + JSON.stringify(SOAP) + '\n```');
		expect(note.assessment).toBe('Otitis externa');
		expect(note.missedCharges).toEqual(['Ear Cytology']);
	});

	it('rejects a reply missing a SOAP section instead of rendering junk', () => {
		expect(() => parseSoapJson(JSON.stringify({ subjective: 'x' }))).toThrow();
		expect(() => parseSoapJson('not json')).toThrow();
	});

	it('turns an empty section into "Not recorded"', () => {
		expect(parseSoapJson(JSON.stringify({ ...SOAP, plan: '  ' })).plan).toBe('Not recorded');
	});
});

describe('structureTranscript', () => {
	it('returns the parsed note and the model that answered', async () => {
		const urls: string[] = [];
		const fetchImpl = (async (url: string) => {
			urls.push(url);
			return vertexOk(JSON.stringify(SOAP));
		}) as unknown as typeof fetch;
		const res = await structureTranscript('ears itchy', fetchImpl, token);
		expect(res.model).toBe('gemini-3.6-flash');
		expect(res.note.subjective).toBe('Itchy ears 3 days');
		expect(urls[0]).toMatch(/locations\/global\/publishers\/google\/models\/gemini-3\.6-flash:generateContent$/);
	});

	it('walks to the fallback model on 404/429 or malformed JSON', async () => {
		const seen: string[] = [];
		const fetchImpl = (async (url: string) => {
			seen.push(url);
			return url.includes('3.6') ? reply(429) : vertexOk(JSON.stringify(SOAP));
		}) as unknown as typeof fetch;
		const res = await structureTranscript('x', fetchImpl, token);
		expect(res.model).toBe('gemini-3.8-flash');
		expect(seen).toHaveLength(2);

		const malformedFetch = (async (url: string) => {
			return url.includes('3.6') ? vertexOk('not valid json') : vertexOk(JSON.stringify(SOAP));
		}) as unknown as typeof fetch;
		const res2 = await structureTranscript('x', malformedFetch, token);
		expect(res2.model).toBe('gemini-3.8-flash');
	});

	it('reports "not configured" when Vertex refuses the service account', async () => {
		const fetchImpl = (async () => reply(403, { error: { status: 'PERMISSION_DENIED' } })) as unknown as typeof fetch;
		await expect(structureTranscript('x', fetchImpl, token)).rejects.toBeInstanceOf(VertexNotConfiguredError);
	});

	it('fails (not "not configured") when every model errors', async () => {
		const fetchImpl = (async () => reply(503)) as unknown as typeof fetch;
		const err = await structureTranscript('x', fetchImpl, token).catch((e) => e);
		expect(err).toBeInstanceOf(Error);
		expect(err).not.toBeInstanceOf(VertexNotConfiguredError);
	});
});
