/**
 * The free VetNotes reader (aiva.md §6: "it's like pdf the free version includes
 * reader functions"). Takes the text of a file the clinic already holds and says
 * what it is: a valid record (with its readable text and integrity result), a
 * record that breaks the format, an older VetNotes export, or not a VetNotes
 * file at all. Pure and local: nothing here touches the network or storage.
 */
import { CanonicalizationError } from './canonical';
import { renderRecordText } from './render';
import { RECORD_FORMAT, type VetRecord } from './types';
import { validateRecord } from './validate';
import { verifyRecord, type VerifyResult } from './verify';

/** Generous for text: the example referral is 4 KB. Attachments are references, never embedded, in v1. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export type ReaderOutcome =
  | { kind: 'record'; record: VetRecord; text: string; integrity: VerifyResult }
  | { kind: 'invalid'; errors: string[] }
  | { kind: 'legacy'; message: string }
  | { kind: 'unreadable'; message: string };

const NOT_A_FILE = "This isn't a VetNotes file. A VetNotes file ends in .vet and is made by VetSorcery or VetNotes.";

export async function readVetnotesFile(text: string): Promise<ReaderOutcome> {
  if (new Blob([text]).size > MAX_FILE_BYTES) {
    return { kind: 'unreadable', message: 'This file is too large to be a VetNotes file.' };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { kind: 'unreadable', message: NOT_A_FILE };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { kind: 'unreadable', message: NOT_A_FILE };
  const d = data as Record<string, unknown>;

  if (d.format !== RECORD_FORMAT) {
    // VetNotes' earlier export (`version` 1.x, `type` soap_note) and the 0.46 draft had no author,
    // sign-off or integrity check, so they cannot be shown as a record.
    if (typeof d.version === 'string' && (d.type === 'soap_note' || d.version === '0.46.0')) {
      return {
        kind: 'legacy',
        message: "This is an older VetNotes export. It has no author, sign-off or integrity check, so it can't be checked or shown as a record. Ask the sender for a new VetNotes file.",
      };
    }
    return { kind: 'unreadable', message: NOT_A_FILE };
  }

  const check = validateRecord(data);
  if (!check.ok) return { kind: 'invalid', errors: check.errors };
  const record = data as VetRecord;
  try {
    const integrity = await verifyRecord(record);
    return { kind: 'record', record, text: renderRecordText(record), integrity };
  } catch (e) {
    if (e instanceof CanonicalizationError) return { kind: 'invalid', errors: [e.message] };
    throw e;
  }
}

/** One plain sentence for the integrity result, with what it does and does not prove. */
export function integrityMessage(result: VerifyResult): { ok: boolean; text: string } {
  if (result.ok) return { ok: true, text: 'Unchanged since it was made. (This shows the file was not altered; it does not prove who made it.)' };
  if (result.reason === 'unsealed') return { ok: false, text: 'This file has no integrity seal, so it cannot be checked for changes.' };
  if (result.reason === 'note_changed') {
    const n = result.noteIds?.length ?? 0;
    return { ok: false, text: `Changed after it was made: ${n === 1 ? 'one note was' : `${n} notes were`} altered. Ask the sender for a fresh copy.` };
  }
  return { ok: false, text: 'Changed after it was made. Ask the sender for a fresh copy.' };
}
