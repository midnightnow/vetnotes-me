// @vitest-environment node
/**
 * The free reader against core's own example file (fixtures/, copied from
 * vetsorcery packages/functions/test/fixtures/vetRecord/). This is the parity
 * check for the vendored library: the browser verifier must accept what core
 * sealed, and the readable text must match what core renders, byte for byte.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { integrityMessage, readVetnotesFile } from './reader';
import { verifyRecord } from './verify';
import type { VetRecord } from './types';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');
const exampleVet = fixture('example-referral.vet');
const exampleTxt = fixture('example-referral.txt');

describe('parity with core', () => {
  it("verifies core's sealed example and renders exactly core's readable text", async () => {
    const out = await readVetnotesFile(exampleVet);
    expect(out.kind).toBe('record');
    if (out.kind !== 'record') return;
    expect(out.integrity).toEqual({ ok: true });
    expect(out.text).toBe(exampleTxt);
  });

  it('still verifies when the file is re-indented or its keys reordered', async () => {
    const record = JSON.parse(exampleVet) as VetRecord;
    const reversed = Object.fromEntries(Object.entries(record).reverse());
    expect(await verifyRecord(JSON.parse(JSON.stringify(reversed)))).toEqual({ ok: true });
  });
});

describe('readVetnotesFile', () => {
  it('names the altered note when one character of it changed', async () => {
    const record = JSON.parse(exampleVet) as VetRecord;
    record.notes[0]!.sections[1]!.text = record.notes[0]!.sections[1]!.text.replace('4/5', '3/5');
    const out = await readVetnotesFile(JSON.stringify(record));
    expect(out.kind === 'record' && out.integrity).toEqual({ ok: false, reason: 'note_changed', noteIds: ['n1'] });
    expect(out.kind === 'record' && integrityMessage(out.integrity).text).toMatch(/one note was altered/);
  });

  it('catches a changed medication dose outside the notes', async () => {
    const record = JSON.parse(exampleVet) as VetRecord;
    record.facts.medications[0]!.dose = '21 mL (1 mg/kg)';
    const out = await readVetnotesFile(JSON.stringify(record));
    expect(out.kind === 'record' && out.integrity).toEqual({ ok: false, reason: 'record_changed' });
  });

  it('shows an unsealed record but says it cannot be checked', async () => {
    const { integrity: _i, ...unsealed } = JSON.parse(exampleVet) as VetRecord;
    const out = await readVetnotesFile(JSON.stringify(unsealed));
    expect(out.kind).toBe('record');
    expect(out.kind === 'record' && integrityMessage(out.integrity)).toEqual({ ok: false, text: expect.stringMatching(/no integrity seal/) });
  });

  it('refuses to show a record that breaks the format, listing why', async () => {
    const record = JSON.parse(exampleVet) as VetRecord;
    record.notes[0]!.author = 'someone@example.test';
    const out = await readVetnotesFile(JSON.stringify(record));
    expect(out).toEqual({ kind: 'invalid', errors: ['notes[0].author: must be a name, not an email address'] });
  });

  it('reports a garbled file as invalid instead of throwing (null list items, missing author, impossible date)', async () => {
    const record = JSON.parse(exampleVet);
    record.notes.push(null);
    delete record.issuer.author;
    record.subject.dob = '2026-02-30';
    const out = await readVetnotesFile(JSON.stringify(record));
    expect(out.kind).toBe('invalid');
    expect(out.kind === 'invalid' && out.errors).toEqual(expect.arrayContaining([
      'issuer.author: required (its name may be null)',
      'subject.dob: must be YYYY-MM-DD or null',
      'notes[1]: must be an object',
    ]));
  });

  it("shows a note that says \"verified: no\" in ordinary prose, and refuses a reformatted scribe stamp", async () => {
    const withNote = (text: string) => {
      const record = JSON.parse(exampleVet);
      record.notes[0].sections[0].text = text;
      return readVetnotesFile(JSON.stringify(record));
    };
    expect((await withNote('Microchip verified: no chip found on scan.')).kind).toBe('record');
    for (const stamped of ['⚠️ VERIFIED: No\nAssessment: otitis', '**VERIFIED: No**', 'VERIFIED: No Gastritis likely']) {
      expect((await withNote(stamped)).kind).toBe('invalid');
    }
  });

  it("recognises VetNotes' older SOAP export and explains it cannot be checked", async () => {
    const old = { version: '1.1', type: 'soap_note', id: 'vet_1', source: 'vetnotes', patient: { id: 'x', species: 'canine' }, data: { subjective: 's' } };
    const out = await readVetnotesFile(JSON.stringify(old));
    expect(out.kind).toBe('legacy');
  });

  it('says plainly when the file is not a VetNotes file', async () => {
    expect((await readVetnotesFile('not json')).kind).toBe('unreadable');
    expect((await readVetnotesFile('[1,2]')).kind).toBe('unreadable');
    expect((await readVetnotesFile('{"hello":"world"}')).kind).toBe('unreadable');
  });

  it('refuses an oversized file without parsing it', async () => {
    const out = await readVetnotesFile('x'.repeat(5 * 1024 * 1024 + 1));
    expect(out).toEqual({ kind: 'unreadable', message: expect.stringMatching(/too large/) });
  });
});
