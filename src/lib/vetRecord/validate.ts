/* VENDORED from midnightnow/vetsorcery packages/functions/src/lib/vetRecord/validate.ts @ e9d167d1 (PR #136).
   Change it there first and re-copy; reader.test.ts checks this copy against core's example file. */
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

/**
 * The AI scribe's own "not yet verified" stamp (voiceNotesProcessor writes
 * `⚠️ VERIFIED: No` on its own line). Such a note never travels. Capitals match
 * anywhere, however the stamp was reformatted on the way (`**VERIFIED: No**`,
 * `(VERIFIED: No)`, run together with the next sentence). Any other casing counts
 * only as a line of its own, so ordinary prose such as "microchip verified: no
 * chip found" is not blamed on the scribe. Server gates (referralPacket.ts,
 * shareTokens.ts) keep their own broader check, which is safe there.
 * The line-only branch must not match line ends: a reader opens files from
 * anywhere, and rescanning blank lines from every line start would hang it.
 */
export const UNVERIFIED_AI_MARKER = /VERIFIED:\s*N[Oo]\b|^[^\p{L}\p{N}\r\n\u2028\u2029]*[Vv][Ee][Rr][Ii][Ff][Ii][Ee][Dd]:[ \t]*[Nn][Oo][^\p{L}\p{N}\r\n\u2028\u2029]*$/mu;

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** A day that exists: the regex alone lets '2026-02-30' through, and Date.parse rolls it into March. */
function isRealDay(y: string, m: string, d: string): boolean {
  const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return dt.getUTCFullYear() === Number(y) && dt.getUTCMonth() === Number(m) - 1 && dt.getUTCDate() === Number(d);
}
function isDay(v: unknown): v is string {
  const m = typeof v === 'string' ? DAY.exec(v) : null;
  return !!m && isRealDay(m[1]!, m[2]!, m[3]!);
}
function isInstant(v: unknown): v is string {
  const m = typeof v === 'string' ? INSTANT.exec(v) : null;
  return !!m && isRealDay(m[1]!, m[2]!, m[3]!) && !isNaN(Date.parse(v as string));
}

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
/** For fields a reader prints if present: absent, null or text — never a number or object (render joins them as text). */
const isOptStr = (v: unknown) => v === undefined || v === null || isStr(v);
const isDayOrNull = (v: unknown) => v === null || isDay(v);
const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
/** People are display names. An email address in a name field is a leak (passport.ts personName). */
const isPersonOrNull = (v: unknown) => v === null || (isStr(v) && !v.includes('@'));

/**
 * Never throws, whatever it is given: a reader opens files from anywhere, and a
 * record it passes must be safe to render (render.ts reads every field checked
 * here). Every list element is checked to be an object before it is read.
 */
export function validateRecord(input: unknown): ValidationResult {
  const errors: string[] = [];
  const err = (path: string, msg: string) => errors.push(`${path}: ${msg}`);
  if (!isObj(input)) return { ok: false, errors: ['record: not an object'] };
  const r = input as unknown as VetRecord;
  /** Iterate a list by index (holes included, as render's for…of sees them), reporting any element that is not an object. */
  const each = (list: unknown[], path: string, fn: (x: Record<string, any>, p: string, i: number) => void) => {
    for (let i = 0; i < list.length; i++) {
      const x = list[i];
      const p = `${path}[${i}]`;
      if (!isObj(x)) err(p, 'must be an object');
      else fn(x, p, i);
    }
  };
  const optStrs = (p: string, x: Record<string, any>, keys: string[]) => {
    for (const k of keys) if (!isOptStr(x[k])) err(`${p}.${k}`, 'must be text or null');
  };

  if (r.format !== RECORD_FORMAT) err('format', `must be "${RECORD_FORMAT}"`);
  if (r.version !== RECORD_VERSION) err('version', `must be "${RECORD_VERSION}"`);
  if (!isNonEmpty(r.id)) err('id', 'required');
  if (!KINDS.includes(r.kind)) err('kind', `must be one of ${KINDS.join(', ')}`);
  if (!isInstant(r.created_at)) err('created_at', 'must be an ISO 8601 instant with an offset');
  if (!isNonEmpty(r.time_zone)) err('time_zone', 'required');
  const rules = KIND_RULES[r.kind] ?? KIND_RULES.passport;

  // Issuer
  if (!isObj(r.issuer)) err('issuer', 'required');
  else {
    if (!isObj(r.issuer.clinic) || !isNonEmpty(r.issuer.clinic.name)) err('issuer.clinic.name', 'required');
    else optStrs('issuer.clinic', r.issuer.clinic, ['phone', 'email', 'address']);
    if (!isObj(r.issuer.author)) err('issuer.author', 'required (its name may be null)');
    else {
      if (!isPersonOrNull(r.issuer.author.name ?? null)) err('issuer.author.name', 'must be a name, not an email address');
      optStrs('issuer.author', r.issuer.author, ['role']);
    }
    if (!isObj(r.issuer.software) || !isNonEmpty(r.issuer.software.name)) err('issuer.software.name', 'required');
  }
  if (r.recipient !== undefined) {
    if (!isObj(r.recipient)) err('recipient', 'must be an object');
    else optStrs('recipient', r.recipient, ['clinic', 'vet']);
  }
  if (r.purpose !== undefined) {
    if (!isObj(r.purpose)) err('purpose', 'must be an object');
    else {
      optStrs('purpose', r.purpose, ['reason']);
      if (!Array.isArray(r.purpose.questions)) err('purpose.questions', 'must be a list of questions');
      else for (let i = 0; i < r.purpose.questions.length; i++) if (!isNonEmpty(r.purpose.questions[i])) err(`purpose.questions[${i}]`, 'must be text');
    }
  }

  // Subject, owner
  if (!isObj(r.subject)) err('subject', 'required');
  else {
    for (const k of ['name', 'species', 'breed', 'sex', 'colour'] as const) if (!isStrOrNull(r.subject[k])) err(`subject.${k}`, 'must be a string or null');
    if (!isDayOrNull(r.subject.dob)) err('subject.dob', 'must be YYYY-MM-DD or null');
    if (r.subject.desexed !== null && typeof r.subject.desexed !== 'boolean') err('subject.desexed', 'must be true, false or null');
    if (!isOptStr(r.subject.microchip)) err('subject.microchip', 'must be text or null');
    if (!rules.microchip && r.subject.microchip != null) err('subject.microchip', `not allowed in a ${r.kind}`);
  }
  if (r.owner !== undefined && !rules.owner) err('owner', `not allowed in a ${r.kind}`);
  if (r.owner !== undefined && rules.owner) {
    if (!isObj(r.owner)) err('owner', 'must be an object');
    else optStrs('owner', r.owner, ['name', 'phone', 'email']);
  }
  if (r.integrity !== undefined) {
    const g = r.integrity as unknown;
    if (!isObj(g) || g.algorithm !== 'sha256' || g.canonicalization !== 'JCS' || !isStr(g.content_sha256) || !/^[0-9a-f]{64}$/.test(g.content_sha256)) {
      err('integrity', 'must be { algorithm: "sha256", canonicalization: "JCS", content_sha256: 64 hex characters }');
    }
  }
  if ((r.kind === 'passport') && (r.purpose !== undefined || r.recipient !== undefined)) err('purpose', 'a passport has no purpose or recipient');

  // Sources
  const sourceIds = new Set<string>();
  if (!Array.isArray(r.sources) || r.sources.length === 0) err('sources', 'at least one source is required');
  else each(r.sources, 'sources', (s, p) => {
    if (!isNonEmpty(s.id)) err(`${p}.id`, 'required');
    else if (sourceIds.has(s.id)) err(`${p}.id`, `duplicate "${s.id}"`);
    else sourceIds.add(s.id);
    if (!SYSTEMS.includes(s.system)) err(`${p}.system`, `must be one of ${SYSTEMS.join(', ')}`);
    if (!METHODS.includes(s.method)) err(`${p}.method`, `must be one of ${METHODS.join(', ')}`);
    if (!isInstant(s.captured_at)) err(`${p}.captured_at`, 'must be an ISO 8601 instant with an offset');
    optStrs(p, s, ['clinic', 'reference']);
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
    each(r.notes, 'notes', (n, p) => {
      claim(`${p}.id`, n.id);
      if (isStr(n.id)) noteIds.add(n.id);
      sourceRef(`${p}.source`, n.source, false);
      if (!isDayOrNull(n.date)) err(`${p}.date`, 'must be YYYY-MM-DD or null');
      if (!isPersonOrNull(n.author)) err(`${p}.author`, 'must be a name, not an email address');
      if (!SIGNOFFS.includes(n.signoff)) err(`${p}.signoff`, `must be one of ${SIGNOFFS.join(', ')}`);
      optStrs(p, n, ['kind', 'problem']);
      if (!Array.isArray(n.sections) || n.sections.length === 0) err(`${p}.sections`, 'a note carries at least one section of text');
      else each(n.sections, `${p}.sections`, (s, sp) => {
        if (!isStrOrNull(s.heading)) err(`${sp}.heading`, 'must be a string or null');
        else if (isStr(s.heading) && UNVERIFIED_AI_MARKER.test(s.heading)) err(`${sp}.heading`, 'carries the unverified AI-draft marker; such a note never travels');
        if (!isNonEmpty(s.text)) err(`${sp}.text`, 'required (an empty section is left out, not carried empty)');
        else if (UNVERIFIED_AI_MARKER.test(s.text)) err(`${sp}.text`, 'carries the unverified AI-draft marker; such a note never travels');
      });
    });
  }

  // Facts
  const f = r.facts;
  if (!isObj(f)) err('facts', 'required');
  else {
    const base = (p: string, x: any) => {
      claim(`${p}.id`, x.id);
      if (!ORIGINS.includes(x.origin)) err(`${p}.origin`, `must be one of ${ORIGINS.join(', ')}`);
      sourceRef(`${p}.source`, x.source, true);
      if (!Array.isArray(x.evidence)) err(`${p}.evidence`, 'must be an array of note ids');
      else for (let k = 0; k < x.evidence.length; k++) if (!isStr(x.evidence[k]) || !noteIds.has(x.evidence[k])) err(`${p}.evidence[${k}]`, 'must name a note id');
    };
    const facts = f as Record<string, any>;
    /** A fact list, each element checked to be an object, then the shared fields (base) and its own. */
    const list = (key: string, fn: (x: Record<string, any>, p: string) => void) => {
      if (!Array.isArray(facts[key])) { err(`facts.${key}`, 'must be an array'); return; }
      each(facts[key], `facts.${key}`, (x, p) => { base(p, x); fn(x, p); });
    };
    const clinical = ['problems', 'medications', 'labs', 'imaging'] as const;
    if (!rules.clinicalFacts) for (const k of clinical) if (Array.isArray(facts[k]) && facts[k].length) err(`facts.${k}`, `not allowed in a ${r.kind}`);

    list('problems', (x, p) => {
      if (!isNonEmpty(x.title)) err(`${p}.title`, 'required');
      if (!PROBLEM_STATUSES.includes(x.status)) err(`${p}.status`, `must be one of ${PROBLEM_STATUSES.join(', ')}`);
      if (!isDayOrNull(x.onset)) err(`${p}.onset`, 'must be YYYY-MM-DD or null');
      if (!isDayOrNull(x.resolved)) err(`${p}.resolved`, 'must be YYYY-MM-DD or null');
    });
    list('medications', (x, p) => {
      if (!MED_STATUSES.includes(x.status)) err(`${p}.status`, `must be one of ${MED_STATUSES.join(', ')}`);
      if (!isDayOrNull(x.prescribed)) err(`${p}.prescribed`, 'must be YYYY-MM-DD or null');
      if (!isDayOrNull(x.end)) err(`${p}.end`, 'must be YYYY-MM-DD or null');
      if (!isDayOrNull(x.script_expires)) err(`${p}.script_expires`, 'must be YYYY-MM-DD or null');
      optStrs(p, x, ['name', 'dose', 'frequency', 'route', 'duration', 'instructions']);
      if (!x.name && !x.dose && !x.instructions) err(p, 'a medication with no name, dose or instructions says nothing');
    });
    const allergies = facts.allergies;
    if (!isObj(allergies) || !ALLERGY_STATUSES.includes(allergies.status) || !Array.isArray(allergies.items)) {
      err('facts.allergies', `needs a status (${ALLERGY_STATUSES.join(', ')}) and an items array`);
    } else {
      if (allergies.status === 'listed' && allergies.items.length === 0) err('facts.allergies', '"listed" with no items');
      if (allergies.status !== 'listed' && allergies.items.length > 0) err('facts.allergies', `"${allergies.status}" must not carry items`);
      each(allergies.items, 'facts.allergies.items', (x, p) => {
        base(p, x);
        if (!isNonEmpty(x.substance)) err(`${p}.substance`, 'required');
        optStrs(p, x, ['reaction']);
      });
    }
    list('vaccinations', (x, p) => {
      if (!isDayOrNull(x.administered)) err(`${p}.administered`, 'must be YYYY-MM-DD or null');
      if (!isDayOrNull(x.valid_until)) err(`${p}.valid_until`, 'must be YYYY-MM-DD or null');
      if (!isDayOrNull(x.batch_expiry)) err(`${p}.batch_expiry`, 'must be YYYY-MM-DD or null');
      if (!isPersonOrNull(x.by)) err(`${p}.by`, 'must be a name, not an email address');
      optStrs(p, x, ['name', 'manufacturer', 'batch', 'route', 'site']);
    });
    list('weights', (x, p) => {
      if (!isDayOrNull(x.date)) err(`${p}.date`, 'must be YYYY-MM-DD or null');
      if (typeof x.kg !== 'number' || !Number.isFinite(x.kg) || x.kg <= 0) err(`${p}.kg`, 'must be a positive number');
    });
    list('labs', (x, p) => {
      if (!isDayOrNull(x.date)) err(`${p}.date`, 'must be YYYY-MM-DD or null');
      if (!isNonEmpty(x.analyte)) err(`${p}.analyte`, 'required');
      if (!isNonEmpty(x.value)) err(`${p}.value`, 'required (as written in the source)');
      optStrs(p, x, ['panel', 'unit', 'reference_range', 'flag', 'attachment']);
    });
    list('imaging', (x, p) => {
      if (!isDayOrNull(x.date)) err(`${p}.date`, 'must be YYYY-MM-DD or null');
      optStrs(p, x, ['modality', 'description', 'study_ref', 'attachment']);
    });
    list('visits', (x, p) => {
      if (!isDayOrNull(x.date)) err(`${p}.date`, 'must be YYYY-MM-DD or null');
      if (!isPersonOrNull(x.vet)) err(`${p}.vet`, 'must be a name, not an email address');
      optStrs(p, x, ['kind']);
    });
  }

  // Attachments, omissions
  if (!Array.isArray(r.attachments)) err('attachments', 'must be an array');
  else {
    if (!rules.notes && r.attachments.length) err('attachments', `not allowed in a ${r.kind}`);
    each(r.attachments, 'attachments', (a, p) => {
      claim(`${p}.id`, a.id);
      if (!isNonEmpty(a.name)) err(`${p}.name`, 'required');
      if (!ATTACHMENT_KINDS.includes(a.kind)) err(`${p}.kind`, `must be one of ${ATTACHMENT_KINDS.join(', ')}`);
      if (a.embedded !== false) err(`${p}.embedded`, 'v1 carries references only');
      sourceRef(`${p}.source`, a.source, true);
    });
  }
  if (!Array.isArray(r.omissions)) err('omissions', 'must be an array');
  else each(r.omissions, 'omissions', (o, p) => {
    if (!isNonEmpty(o.what) || !isNonEmpty(o.reason)) err(p, 'needs what and reason');
  });

  return { ok: errors.length === 0, errors };
}
