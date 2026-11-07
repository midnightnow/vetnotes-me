/* VENDORED from midnightnow/vetsorcery packages/functions/src/lib/vetRecord/render.ts @ b41dd0d1 (PR #150).
   Change it there first and re-copy; reader.test.ts checks this copy against core's example file. */
/**
 * The readable rendering of a VetNotes Record: plain text a vet can read top to
 * bottom, print, or paste into any PMS. Deterministic (no clock, no locale), and
 * it re-lays out the record without rewording it:
 *  - safety first: allergies, then medications on record, then the rest of the facts;
 *  - original notes word for word, each under a provenance line saying where it
 *    came from, who wrote it, when, and whether it was signed off;
 *  - what was left out, and what the integrity digest does and does not prove.
 * A missing value prints as "Not recorded", never as a guess.
 */
import type { NoteSignoff, RecordKind, RecordNote, RecordSource, VetRecord } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NOT_RECORDED = 'Not recorded';

const KIND_TITLE: Record<RecordKind, string> = {
  referral: 'Referral',
  transfer: 'Transfer of records',
  history: 'Clinical history',
  passport: 'Pet health passport',
};

const SIGNOFF_LABEL: Record<NoteSignoff, string> = {
  signed: "signed off (signer's role not recorded)",
  finalised: 'finalised',
  unsigned: 'NOT SIGNED OFF',
  unknown: 'sign-off not shown in the source',
};

/** Only a note that names its signer says who signed: older files, and other systems, do not. */
function signoffLabel(n: RecordNote): string {
  if (n.signoff === 'signed' && n.signer === 'vet') return 'signed off by the vet';
  if (n.signoff === 'signed' && n.signer === 'clinic_owner_unverified') return 'signed off by the clinic owner (no verified vet registration on file)';
  return SIGNOFF_LABEL[n.signoff] ?? n.signoff;
}

const SYSTEM_LABEL: Record<string, string> = {
  vetsorcery: 'VetSorcery', ezyvet: 'ezyVet', rxworks: 'RxWorks', vetnotes: 'VetNotes', other: 'Other system',
};

/** '2026-03-07' → '7 Mar 2026'. Anything else is printed as given. */
export function formatDay(day: string | null | undefined): string {
  if (!day) return NOT_RECORDED;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month} ${m[1]}` : day;
}

const join = (parts: Array<string | null | undefined>, sep = ' · ') => parts.filter((p) => p && p.trim()).join(sep);
const or = (v: string | null | undefined) => (v && v.trim() ? v : NOT_RECORDED);

function sourceLabel(src: RecordSource | undefined): string {
  if (!src) return 'Unknown source';
  return join([SYSTEM_LABEL[src.system] ?? src.system, src.clinic ? `(${src.clinic})` : null], ' ');
}

export function renderRecordText(record: VetRecord): string {
  const out: string[] = [];
  const line = (s = '') => out.push(s);
  const heading = (title: string, note?: string) => { line(); line(note ? `${title.toUpperCase()} ${note}` : title.toUpperCase()); };
  const sources = new Map(record.sources.map((s) => [s.id, s]));
  const s = record.subject;
  const f = record.facts;

  line(`VETNOTES RECORD — ${KIND_TITLE[record.kind] ?? record.kind}`);
  const sexLine = s.sex ? `${s.sex}${s.desexed === true ? ' (desexed)' : s.desexed === false ? ' (entire)' : ''}` : null;
  line(join([or(s.name), s.species, s.breed, sexLine, s.dob ? `born ${formatDay(s.dob)}` : null, s.colour]));
  if (s.microchip) line(`Microchip: ${s.microchip}`);
  line(`From: ${join([record.issuer.clinic.name, record.issuer.author.name, record.issuer.clinic.phone])}`);
  if (record.recipient) line(`To: ${join([record.recipient.clinic, record.recipient.vet]) || NOT_RECORDED}`);
  line(`Made: ${record.created_at} (clinical dates are days in ${record.time_zone})`);
  if (record.owner) line(`Owner: ${join([record.owner.name, record.owner.phone, record.owner.email]) || NOT_RECORDED}`);

  if (record.purpose) {
    heading(record.kind === 'referral' ? 'Reason for referral' : 'Reason', record.kind === 'referral' ? "(the referring vet's words)" : "(the sending vet's words)");
    line(or(record.purpose.reason));
    for (const q of record.purpose.questions) line(`- ${q}`);
  }

  heading('Allergies');
  if (f.allergies.status === 'listed') for (const a of f.allergies.items) line(`- ${join([a.substance, a.reaction], ' — ')}`);
  else if (f.allergies.status === 'none_known') line('No known allergies, as recorded by the sending clinic.');
  else line(`${NOT_RECORDED} in this file. This does not mean there are none.`);

  if (record.kind !== 'passport') {
    const onRecord = f.medications.some((m) => m.status === 'on_record');
    heading(onRecord ? 'Medications on record' : 'Medications', onRecord ? '(recorded as active; not confirmed current)' : undefined);
    if (!f.medications.length) line(NOT_RECORDED);
    for (const m of f.medications) {
      line(`- ${join([or(m.name), m.dose, m.frequency, m.route, m.duration], ' — ')}`);
      const dates = join([
        m.prescribed ? `prescribed ${formatDay(m.prescribed)}` : null,
        m.end ? `ended ${formatDay(m.end)}` : null,
        m.script_expires ? `script expires ${formatDay(m.script_expires)}` : null,
        m.status === 'current' ? 'confirmed current by the sending vet' : m.status === 'past' ? 'past' : null,
      ], ', ');
      if (dates) line(`  ${dates}`);
      if (m.instructions) line(`  Instructions: ${m.instructions}`);
    }
  }

  if (f.problems.length) {
    heading('Problems');
    for (const p of f.problems) {
      const status = p.status === 'not_recorded' ? null : p.status;
      line(`- ${join([p.title, status, p.onset ? `from ${formatDay(p.onset)}` : null, p.resolved ? `resolved ${formatDay(p.resolved)}` : null])}`);
    }
  }

  if (f.weights.length) {
    heading('Weights');
    // A weight with no date must not read as a missing weight.
    for (const w of f.weights) line(w.date ? `- ${formatDay(w.date)}: ${w.kg} kg` : `- ${w.kg} kg (date not recorded)`);
  }

  if (f.vaccinations.length || record.kind === 'passport') {
    heading('Vaccinations');
    if (!f.vaccinations.length) line(NOT_RECORDED);
    for (const v of f.vaccinations) {
      line(`- ${join([or(v.name), v.manufacturer])}`);
      line(`  given ${formatDay(v.administered)}${v.valid_until ? `, valid until ${formatDay(v.valid_until)}` : ''}${v.by ? `, by ${v.by}` : ''}`);
      const batch = join([v.batch ? `batch ${v.batch}` : null, v.batch_expiry ? `batch expiry ${formatDay(v.batch_expiry)}` : null, v.route, v.site], ', ');
      if (batch) line(`  ${batch}`);
    }
  }

  if (f.labs.length) {
    heading('Laboratory results');
    for (const l of f.labs) {
      line(`- ${formatDay(l.date)} ${join([l.panel, l.analyte], ': ')} ${l.value}${l.unit ? ` ${l.unit}` : ''}${l.reference_range ? ` (ref ${l.reference_range})` : ''}${l.flag ? ` ${l.flag}` : ''}`);
    }
  }

  if (f.imaging.length) {
    heading('Imaging');
    for (const im of f.imaging) {
      line(`- ${join([im.date ? formatDay(im.date) : null, im.modality, im.description, im.study_ref ? `ref ${im.study_ref}` : null]) || NOT_RECORDED}`);
    }
  }

  if (f.visits.length) {
    heading('Visits');
    for (const v of f.visits) line(`- ${formatDay(v.date)}${v.kind ? ` — ${v.kind}` : ''}${v.vet ? ` — ${v.vet}` : ''}`);
  }

  if (record.notes.length) {
    heading('Original notes', '(word for word)');
    for (const n of record.notes) {
      line();
      line(`── ${join([formatDay(n.date), sourceLabel(sources.get(n.source)), n.author ?? 'author not recorded', signoffLabel(n)])}`);
      if (n.problem) line(`Problem: ${n.problem}`);
      for (const section of n.sections) {
        if (section.heading) line(section.heading);
        line(section.text);
      }
    }
  }

  if (record.attachments.length) {
    heading('Attachments', '(referenced, not included)');
    for (const a of record.attachments) line(`- ${a.name} (${a.kind})`);
  }

  if (record.omissions.length) {
    heading('Left out');
    for (const o of record.omissions) line(`- ${o.what}: ${o.reason}`);
  }

  heading('Integrity');
  if (record.integrity) {
    line(`sha256 ${record.integrity.content_sha256} (${record.integrity.canonicalization}).`);
    line('This shows the file has not changed since it was made. It does not prove who made it.');
  } else {
    line('Not sealed.');
  }
  return out.join('\n') + '\n';
}
