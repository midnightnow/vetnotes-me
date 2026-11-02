/* VENDORED from midnightnow/vetsorcery packages/functions/src/lib/vetRecord/validate.ts @ dafb4a1a.
   Change it there first and re-copy; parity.test.ts checks this copy against core's example file. */
/**
 * Structural and privacy validation for a VetNotes Record. A reader runs this
 * before showing a file; a writer runs it before sealing. Returns every problem
 * found, not just the first, so a converter bug is visible in one pass.
 */
import { RECORD_FORMAT, RECORD_VERSION, type RecordKind, type VetRecord } from './types';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const KINDS: RecordKind[] = ['referral', 'transfer', 'history', 'passport'];
const SYSTEMS = ['vetsorcery', 'ezyvet', 'rxworks', 'vetnotes', 'other'];
const METHODS = ['export', 'page', 'document', 'typed'];
const ORIGINS = ['record', 'page', 'entered'];
const SIGNOFFS = ['signed', 'finalised', 'unsigned', 'unknown'];
const MED_STATUSES = ['on_record', 'current', 'past'];
const PROBLEM_STATUSES = ['active', 'resolved', 'not_recorded'];
const ALLERGY_STATUSES = ['listed', 'none_known', 'not_recorded'];
const ATTACHMENT_KINDS = ['radiograph', 'lab_report', 'image', 'document', 'other'];

/** The AI scribe's own "not yet verified" stamp (voiceNotesProcessor). Such a note never travels. */
export const UNVERIFIED_AI_MARKER = /\bVERIFIED:\s*No\b/i;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * What each kind may carry. A passport is the kennel/boarding card: the same
 * allowlist as the public passport link (shareTokens.ts publicSnapshotView) —
 * no owner, no notes, no medications, no microchip.
 */
const KIND_RULES: Record<RecordKind, { owner: boolean; notes: boolean; clinicalFacts: boolean; microchip: boolean }> = {
  referral: { owner: true, notes: true, clinicalFacts: true, microchip: true },
  transfer: { owner: true, notes: true, clinicalFacts: true, microchip: true },
  history: { owner: false, notes: true, clinicalFacts: true, microchip: true },
  passport: { owner: false, notes: false, clinicalFacts: false, microchip: false },
};

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNonEmpty = (v: unknown): v is string => isStr(v) && v.trim().length > 0;
const isStrOrNull = (v: unknown) => v === null || isStr(v);
const isDayOrNull = (v: unknown) => v === null || (isStr(v) && DAY.test(v));
/** People are display names. An email address in a name field is a leak (passport.ts personName). */
const isPersonOrNull = (v: unknown) => v === null || (isStr(v) && !v.includes('@'));

export function validateRecord(input: unknown): ValidationResult {
  const errors: string[] = [];
  const err = (path: string, msg: string) => errors.push(`${path}: ${msg}`);
  const r = input as VetRecord;
  if (!r || typeof r !== 'object') return { ok: false, errors: ['record: not an object'] };

  if (r.format !== RECORD_FORMAT) err('format', `must be "${RECORD_FORMAT}"`);
  if (r.version !== RECORD_VERSION) err('version', `must be "${RECORD_VERSION}"`);
  if (!isNonEmpty(r.id)) err('id', 'required');
  if (!KINDS.includes(r.kind)) err('kind', `must be one of ${KINDS.join(', ')}`);
  if (!isStr(r.created_at) || !INSTANT.test(r.created_at) || isNaN(Date.parse(r.created_at))) err('created_at', 'must be an ISO 8601 instant with an offset');
  if (!isNonEmpty(r.time_zone)) err('time_zone', 'required');
  const rules = KIND_RULES[r.kind] ?? KIND_RULES.passport;

  // Issuer
  if (!r.issuer || !isNonEmpty(r.issuer.clinic?.name)) err('issuer.clinic.name', 'required');
  if (r.issuer && !isPersonOrNull(r.issuer.author?.name ?? null)) err('issuer.author.name', 'must be a name, not an email address');
  if (r.issuer && !isNonEmpty(r.issuer.software?.name)) err('issuer.software.name', 'required');

  // Subject, owner
  if (!r.subject || typeof r.subject !== 'object') err('subject', 'required');
  else {
    for (const k of ['name', 'species', 'breed', 'sex', 'colour'] as const) if (!isStrOrNull(r.subject[k])) err(`subject.${k}`, 'must be a string or null');
    if (!isDayOrNull(r.subject.dob)) err('subject.dob', 'must be YYYY-MM-DD or null');
    if (r.subject.desexed !== null && typeof r.subject.desexed !== 'boolean') err('subject.desexed', 'must be true, false or null');
    if (!rules.microchip && r.subject.microchip != null) err('subject.microchip', `not allowed in a ${r.kind}`);
  }
  if (r.owner !== undefined && !rules.owner) err('owner', `not allowed in a ${r.kind}`);
  if ((r.kind === 'passport') && (r.purpose !== undefined || r.recipient !== undefined)) err('purpose', 'a passport has no purpose or recipient');

  // Sources
  const sourceIds = new Set<string>();
  if (!Array.isArray(r.sources) || r.sources.length === 0) err('sources', 'at least one source is required');
  else r.sources.forEach((s, i) => {
    const p = `sources[${i}]`;
    if (!isNonEmpty(s.id)) err(`${p}.id`, 'required');
    else if (sourceIds.has(s.id)) err(`${p}.id`, `duplicate "${s.id}"`);
    else sourceIds.add(s.id);
    if (!SYSTEMS.includes(s.system)) err(`${p}.system`, `must be one of ${SYSTEMS.join(', ')}`);
    if (!METHODS.includes(s.method)) err(`${p}.method`, `must be one of ${METHODS.join(', ')}`);
    if (!isStr(s.captured_at) || isNaN(Date.parse(s.captured_at))) err(`${p}.captured_at`, 'must be an ISO 8601 instant');
  });
  const sourceRef = (p: string, v: unknown, nullable: boolean) => {
    if (v === null && nullable) return;
    if (!isStr(v) || !sourceIds.has(v)) err(p, `must name a source id${nullable ? ' or be null' : ''}`);
  };

  // Notes
  const ids = new Set<string>();
  const claim = (p: string, id: unknown): void => {
    if (!isNonEmpty(id)) err(p, 'required');
    else if (ids.has(id)) err(p, `duplicate id "${id}"`);
    else ids.add(id);
  };
  const noteIds = new Set<string>();
  if (!Array.isArray(r.notes)) err('notes', 'must be an array');
  else {
    if (!rules.notes && r.notes.length) err('notes', `not allowed in a ${r.kind}`);
    r.notes.forEach((n, i) => {
      const p = `notes[${i}]`;
      claim(`${p}.id`, n.id);
      if (isStr(n.id)) noteIds.add(n.id);
      sourceRef(`${p}.source`, n.source, false);
      if (!isDayOrNull(n.date)) err(`${p}.date`, 'must be YYYY-MM-DD or null');
      if (!isPersonOrNull(n.author)) err(`${p}.author`, 'must be a name, not an email address');
      if (!SIGNOFFS.includes(n.signoff)) err(`${p}.signoff`, `must be one of ${SIGNOFFS.join(', ')}`);
      if (!Array.isArray(n.sections) || n.sections.length === 0) err(`${p}.sections`, 'a note carries at least one section of text');
      else n.sections.forEach((s, j) => {
        if (!isStrOrNull(s.heading)) err(`${p}.sections[${j}].heading`, 'must be a string or null');
        if (!isNonEmpty(s.text)) err(`${p}.sections[${j}].text`, 'required (an empty section is left out, not carried empty)');
        else if (UNVERIFIED_AI_MARKER.test(s.text)) err(`${p}.sections[${j}].text`, 'carries the unverified AI-draft marker; such a note never travels');
      });
    });
  }

  // Facts
  const f = r.facts;
  if (!f || typeof f !== 'object') err('facts', 'required');
  else {
    const base = (p: string, x: any) => {
      claim(`${p}.id`, x.id);
      if (!ORIGINS.includes(x.origin)) err(`${p}.origin`, `must be one of ${ORIGINS.join(', ')}`);
      sourceRef(`${p}.source`, x.source, true);
      if (!Array.isArray(x.evidence)) err(`${p}.evidence`, 'must be an array of note ids');
      else x.evidence.forEach((e: unknown, k: number) => { if (!isStr(e) || !noteIds.has(e)) err(`${p}.evidence[${k}]`, 'must name a note id'); });
    };
    const list = (key: keyof typeof f) => (Array.isArray(f[key]) ? (f[key] as any[]) : (err(`facts.${String(key)}`, 'must be an array'), []));
    const clinical = ['problems', 'medications', 'labs', 'imaging'] as const;
    if (!rules.clinicalFacts) for (const k of clinical) if (Array.isArray(f[k]) && f[k].length) err(`facts.${k}`, `not allowed in a ${r.kind}`);

    list('problems').forEach((x, i) => {
      const p = `facts.problems[${i}]`; base(p, x);
      if (!isNonEmpty(x.title)) err(`${p}.title`, 'required');
      if (!PROBLEM_STATUSES.includes(x.status)) err(`${p}.status`, `must be one of ${PROBLEM_STATUSES.join(', ')}`);
      if (!isDayOrNull(x.onset)) err(`${p}.onset`, 'must be YYYY-MM-DD or null');
      if (!isDayOrNull(x.resolved)) err(`${p}.resolved`, 'must be YYYY-MM-DD or null');
    });
    list('medications').forEach((x, i) => {
      const p = `facts.medications[${i}]`; base(p, x);
      if (!MED_STATUSES.includes(x.status)) err(`${p}.status`, `must be one of ${MED_STATUSES.join(', ')}`);
      if (!isDayOrNull(x.prescribed)) err(`${p}.prescribed`, 'must be YYYY-MM-DD or null');
      if (!isDayOrNull(x.end)) err(`${p}.end`, 'must be YYYY-MM-DD or null');
      if (!isDayOrNull(x.script_expires)) err(`${p}.script_expires`, 'must be YYYY-MM-DD or null');
      if (!x.name && !x.dose && !x.instructions) err(p, 'a medication with no name, dose or instructions says nothing');
    });
    const allergies = f.allergies;
    if (!allergies || !ALLERGY_STATUSES.includes(allergies.status) || !Array.isArray(allergies.items)) {
      err('facts.allergies', `needs a status (${ALLERGY_STATUSES.join(', ')}) and an items array`);
    } else {
      if (allergies.status === 'listed' && allergies.items.length === 0) err('facts.allergies', '"listed" with no items');
      if (allergies.status !== 'listed' && allergies.items.length > 0) err('facts.allergies', `"${allergies.status}" must not carry items`);
      allergies.items.forEach((x, i) => {
        const p = `facts.allergies.items[${i}]`; base(p, x);
        if (!isNonEmpty(x.substance)) err(`${p}.substance`, 'required');
      });
    }
    list('vaccinations').forEach((x, i) => {
      const p = `facts.vaccinations[${i}]`; base(p, x);
      if (!isDayOrNull(x.administered)) err(`${p}.administered`, 'must be YYYY-MM-DD or null');
      if (!isDayOrNull(x.valid_until)) err(`${p}.valid_until`, 'must be YYYY-MM-DD or null');
      if (!isDayOrNull(x.batch_expiry)) err(`${p}.batch_expiry`, 'must be YYYY-MM-DD or null');
      if (!isPersonOrNull(x.by)) err(`${p}.by`, 'must be a name, not an email address');
    });
    list('weights').forEach((x, i) => {
      const p = `facts.weights[${i}]`; base(p, x);
      if (!isDayOrNull(x.date)) err(`${p}.date`, 'must be YYYY-MM-DD or null');
      if (typeof x.kg !== 'number' || !Number.isFinite(x.kg) || x.kg <= 0) err(`${p}.kg`, 'must be a positive number');
    });
    list('labs').forEach((x, i) => {
      const p = `facts.labs[${i}]`; base(p, x);
      if (!isDayOrNull(x.date)) err(`${p}.date`, 'must be YYYY-MM-DD or null');
      if (!isNonEmpty(x.analyte)) err(`${p}.analyte`, 'required');
      if (!isNonEmpty(x.value)) err(`${p}.value`, 'required (as written in the source)');
    });
    list('imaging').forEach((x, i) => {
      const p = `facts.imaging[${i}]`; base(p, x);
      if (!isDayOrNull(x.date)) err(`${p}.date`, 'must be YYYY-MM-DD or null');
    });
    list('visits').forEach((x, i) => {
      const p = `facts.visits[${i}]`; base(p, x);
      if (!isDayOrNull(x.date)) err(`${p}.date`, 'must be YYYY-MM-DD or null');
      if (!isPersonOrNull(x.vet)) err(`${p}.vet`, 'must be a name, not an email address');
    });
  }

  // Attachments, omissions
  if (!Array.isArray(r.attachments)) err('attachments', 'must be an array');
  else {
    if (!rules.notes && r.attachments.length) err('attachments', `not allowed in a ${r.kind}`);
    r.attachments.forEach((a, i) => {
      const p = `attachments[${i}]`;
      claim(`${p}.id`, a.id);
      if (!isNonEmpty(a.name)) err(`${p}.name`, 'required');
      if (!ATTACHMENT_KINDS.includes(a.kind)) err(`${p}.kind`, `must be one of ${ATTACHMENT_KINDS.join(', ')}`);
      if (a.embedded !== false) err(`${p}.embedded`, 'v1 carries references only');
      sourceRef(`${p}.source`, a.source, true);
    });
  }
  if (!Array.isArray(r.omissions)) err('omissions', 'must be an array');
  else r.omissions.forEach((o, i) => {
    if (!isNonEmpty(o.what) || !isNonEmpty(o.reason)) err(`omissions[${i}]`, 'needs what and reason');
  });

  return { ok: errors.length === 0, errors };
}
