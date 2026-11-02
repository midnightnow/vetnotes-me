/* VENDORED from midnightnow/vetsorcery packages/functions/src/lib/vetRecord/types.ts @ ee5677fa (PR #135).
   Change it there first and re-copy; reader.test.ts checks this copy against core's example file. */
/**
 * VetNotes Record — the portable clinical record file (`.vet`, format "vetnotes.record").
 *
 * One JSON document carries a pet's history between clinics: the original notes
 * word for word with where they came from, the structured facts a receiving vet
 * needs, and an integrity digest. The passport and the referral packet are
 * views of it (fromPassport.ts, fromReferralPacket.ts). Design and rationale:
 * VET repo docs/superpowers/specs/2026-11-02-vetnotes-record-format-design.md.
 *
 * Rules the types encode (validate.ts enforces them):
 *  - Notes are the record and are never rewritten. Facts are an index into the
 *    record: every fact comes from a structured field in the source system or
 *    was typed into the file by the sending vet. v1 never derives a fact from
 *    note text, by AI or otherwise.
 *  - Clinical dates are clinic-local calendar days ('YYYY-MM-DD') in `time_zone`,
 *    the same convention as the passport (lib/passport.ts wireDate).
 *  - People are display names, never email addresses.
 *  - A missing value is null, never a plausible default.
 */

export const RECORD_FORMAT = 'vetnotes.record' as const;
export const RECORD_VERSION = '1.0.0' as const;

/** What the file is for. Decides which sections may be present (validate.ts KIND_RULES). */
export type RecordKind = 'referral' | 'transfer' | 'history' | 'passport';

export type SourceSystem = 'vetsorcery' | 'ezyvet' | 'rxworks' | 'vetnotes' | 'other';

/**
 * How the content left the source system:
 *  export   — read from the source system's own stored records (VetSorcery server);
 *  page     — read from a PIMS page by the VetSorcery extension;
 *  document — read from a printed or exported history document (e.g. an RxWorks PDF);
 *  typed    — typed into the file by the sending vet.
 */
export type CaptureMethod = 'export' | 'page' | 'document' | 'typed';

/** Where a fact came from. There is deliberately no "extracted" or "ai" value in v1. */
export type FactOrigin = 'record' | 'page' | 'entered';

/**
 * signed    — a vet signed it in the source system;
 * finalised — saved and finalised (VetSorcery consult workspace);
 * unsigned  — neither;
 * unknown   — the source does not say (most page captures).
 */
export type NoteSignoff = 'signed' | 'finalised' | 'unsigned' | 'unknown';

export interface RecordSource {
  id: string;
  system: SourceSystem;
  /** Clinic that holds the original. */
  clinic: string | null;
  captured_at: string;
  method: CaptureMethod;
  /** The source clinic's own patient number, so the receiver can quote it back. Optional. */
  reference: string | null;
}

export interface RecordIssuer {
  clinic: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
  /** The vet who made and sent the file. */
  author: { name: string | null; role: string | null };
  software: { name: string; version: string | null };
}

export interface RecordRecipient {
  clinic: string | null;
  vet: string | null;
}

/** The referring vet's own words. Never generated. */
export interface RecordPurpose {
  reason: string | null;
  questions: string[];
}

export interface RecordSubject {
  name: string | null;
  species: string | null;
  breed: string | null;
  sex: string | null;
  desexed: boolean | null;
  dob: string | null;
  colour: string | null;
  /** Only when the sending vet includes it; never in a passport. */
  microchip?: string | null;
}

/** Only in referral and transfer files, and only when the sending vet includes it. */
export interface RecordOwner {
  name: string | null;
  phone: string | null;
  email: string | null;
}

export interface NoteSection {
  /** The heading as the source shows it ('Subjective', 'History', 'Clinical notes'), or null. */
  heading: string | null;
  /** Verbatim. */
  text: string;
}

export interface RecordNote {
  id: string;
  source: string;
  date: string | null;
  author: string | null;
  signoff: NoteSignoff;
  /** Free label from the source: 'consult', 'voice_note', 'history', 'surgery', … */
  kind: string | null;
  /** Problem the note was written against, as titled in the source. */
  problem: string | null;
  /** In source order. A section the source left empty is not carried. */
  sections: NoteSection[];
  /** SHA-256 of the note's canonical form without this field (seal.ts). Lets one note be checked on its own. */
  sha256?: string;
}

export interface FactBase {
  id: string;
  origin: FactOrigin;
  /** Source the fact came from. */
  source: string | null;
  /** Notes that mention it, when known. Never used to invent the fact. */
  evidence: string[];
}

export type ProblemStatus = 'active' | 'resolved' | 'not_recorded';

export interface RecordProblem extends FactBase {
  title: string;
  status: ProblemStatus;
  onset: string | null;
  resolved: string | null;
}

/**
 * on_record — the source lists it as active but nothing confirms the pet is still on it
 *             (VetSorcery prescriptions are never closed when a course ends);
 * current   — the sending vet confirmed it is current;
 * past      — ended.
 */
export type MedicationStatus = 'on_record' | 'current' | 'past';

export interface RecordMedication extends FactBase {
  name: string | null;
  dose: string | null;
  frequency: string | null;
  route: string | null;
  duration: string | null;
  instructions: string | null;
  /** Day it was prescribed or dispensed, as recorded. Not proof the course started that day. */
  prescribed: string | null;
  end: string | null;
  /** Expiry of the prescription itself (script validity), which is not when the course ends. */
  script_expires: string | null;
  status: MedicationStatus;
}

/**
 * listed       — `items` holds what the source records;
 * none_known   — the source explicitly records no known allergies;
 * not_recorded — the source says nothing. An empty list is never read as "none".
 */
export type AllergyStatus = 'listed' | 'none_known' | 'not_recorded';

export interface RecordAllergy extends FactBase {
  substance: string;
  reaction: string | null;
}

export interface RecordVaccination extends FactBase {
  name: string | null;
  manufacturer: string | null;
  batch: string | null;
  batch_expiry: string | null;
  administered: string | null;
  valid_until: string | null;
  by: string | null;
  route: string | null;
  site: string | null;
}

export interface RecordWeight extends FactBase {
  date: string | null;
  kg: number;
}

export interface RecordLab extends FactBase {
  date: string | null;
  panel: string | null;
  analyte: string;
  value: string;
  unit: string | null;
  reference_range: string | null;
  flag: string | null;
  attachment: string | null;
}

export interface RecordImaging extends FactBase {
  date: string | null;
  modality: string | null;
  description: string | null;
  /** Study id in the source system (VetSorcery imaging study id, PIMS attachment id). */
  study_ref: string | null;
  attachment: string | null;
}

/** A visit with no text: the passport diary line (date, fixed kind label, vet). */
export interface RecordVisit extends FactBase {
  date: string | null;
  kind: string | null;
  vet: string | null;
}

export interface RecordFacts {
  problems: RecordProblem[];
  medications: RecordMedication[];
  allergies: { status: AllergyStatus; items: RecordAllergy[] };
  vaccinations: RecordVaccination[];
  weights: RecordWeight[];
  labs: RecordLab[];
  imaging: RecordImaging[];
  visits: RecordVisit[];
}

export type AttachmentKind = 'radiograph' | 'lab_report' | 'image' | 'document' | 'other';

export interface RecordAttachment {
  id: string;
  name: string;
  media_type: string | null;
  kind: AttachmentKind;
  source: string | null;
  /** v1 carries references only; embedding the bytes is a later container decision. */
  embedded: false;
  bytes: number | null;
  sha256: string | null;
}

/** Something the sender's tool left out on purpose, said out loud so the receiver knows. */
export interface RecordOmission {
  what: string;
  reason: string;
}

export interface RecordIntegrity {
  algorithm: 'sha256';
  /** RFC 8785 JSON Canonicalization Scheme over the record without `integrity`. */
  canonicalization: 'JCS';
  content_sha256: string;
}

export interface VetRecord {
  format: typeof RECORD_FORMAT;
  version: typeof RECORD_VERSION;
  id: string;
  kind: RecordKind;
  created_at: string;
  /** IANA zone the clinical day-dates are in. */
  time_zone: string;
  issuer: RecordIssuer;
  recipient?: RecordRecipient;
  purpose?: RecordPurpose;
  subject: RecordSubject;
  owner?: RecordOwner;
  sources: RecordSource[];
  notes: RecordNote[];
  facts: RecordFacts;
  attachments: RecordAttachment[];
  omissions: RecordOmission[];
  integrity?: RecordIntegrity;
}

export function emptyFacts(): RecordFacts {
  return {
    problems: [],
    medications: [],
    allergies: { status: 'not_recorded', items: [] },
    vaccinations: [],
    weights: [],
    labs: [],
    imaging: [],
    visits: [],
  };
}
