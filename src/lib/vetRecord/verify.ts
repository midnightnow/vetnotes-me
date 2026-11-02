/**
 * Browser integrity check for a VetNotes Record: the same digests as core's
 * seal.ts (SHA-256 over the RFC 8785 canonical form, one per note and one per
 * record), computed with WebCrypto so the file never leaves the computer.
 * Core seals; this side only verifies, so there is no sealRecord here.
 */
import { canonicalJson } from './canonical';
import type { RecordNote, VetRecord } from './types';

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'unsealed' | 'record_changed' | 'note_changed'; noteIds?: string[] };

async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function noteDigest(note: RecordNote): Promise<string> {
  const { sha256: _omit, ...rest } = note;
  return sha256Hex(canonicalJson(rest));
}

export function recordDigest(record: VetRecord): Promise<string> {
  const { integrity: _omit, ...rest } = record;
  return sha256Hex(canonicalJson(rest));
}

export async function verifyRecord(record: VetRecord): Promise<VerifyResult> {
  const integrity = record.integrity;
  if (!integrity || integrity.algorithm !== 'sha256' || integrity.canonicalization !== 'JCS' || !integrity.content_sha256) {
    return { ok: false, reason: 'unsealed' };
  }
  const changedNotes: string[] = [];
  for (const n of record.notes) {
    if (!n.sha256 || n.sha256 !== (await noteDigest(n))) changedNotes.push(n.id);
  }
  if (changedNotes.length) return { ok: false, reason: 'note_changed', noteIds: changedNotes };
  if ((await recordDigest(record)) !== integrity.content_sha256) return { ok: false, reason: 'record_changed' };
  return { ok: true };
}
