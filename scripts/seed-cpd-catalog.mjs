/**
 * Seed the CPD catalogue so multiple real, completable, free cases exist.
 * Data-driven + idempotent. Supersedes seed-flagship-cpd.mjs.
 *
 * For each case: patches the public doc (is_free, session_type, hours), writes
 * private/reveal (answer key + gold differential + expert insight), and a
 * cpd_session (attendance + completion record; duration = hours*60).
 *
 * Run:  GOOGLE_TOKEN=$(gcloud auth print-access-token) node scripts/seed-cpd-catalog.mjs
 * Writes to project `vetsorcery` Firestore (where CPD data lives). VT flow is used
 * because these cases have empty image URLs (the IMAGING DICOM viewer would break).
 */
const TOKEN = process.env.GOOGLE_TOKEN;
if (!TOKEN) { console.error('Set GOOGLE_TOKEN=$(gcloud auth print-access-token)'); process.exit(1); }
const BASE = 'https://firestore.googleapis.com/v1/projects/vetsorcery/databases/(default)/documents';

function enc(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
}
const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));
async function patch(path, obj, mask) {
  const q = (mask || []).map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const r = await fetch(`${BASE}/${path}${q ? '?' + q : ''}`, { method: 'PATCH', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: fields(obj) }) });
  console.log(`${path} -> ${r.status}`);
  if (!r.ok) console.error(await r.text());
}

const CASES = [
  {
    id: 'case_rad_001_chf', sessionId: 'sess_rad_thoracic_01', moduleId: 'mod_rad_001', hours: 2.5,
    sessionTitle: 'Canine Congestive Heart Failure — Thoracic Radiography',
    sessionDesc: 'Interpret a thoracic radiograph of a dog in respiratory distress; reason to a differential, calibrate against the expert read, and verify with a clinical-decision quiz.',
    gold: ['congestive', 'chf', 'cardiogenic', 'oedema', 'edema', 'mitral', 'mmvd', 'left atrial'],
    insight: 'Cardiogenic pulmonary oedema from left-sided CHF: generalised cardiomegaly (VHS > 10.5), left atrial enlargement displacing the carina, caudodorsal alveolar pattern with pulmonary venous distension. Commonest cause in older small breeds is MMVD. First-line: IV furosemide + oxygen; pimobendan and echo follow stabilisation.',
    quiz: [
      { question_id: 'q_chf_001', correct_option_index: 1, explanation: 'Cardiogenic pulmonary oedema — venous congestion + LA enlargement is classic left-sided CHF.' },
      { question_id: 'q_chf_002', correct_option_index: 1, explanation: 'Vertebral heart score (VHS) is the standard radiographic quantifier of cardiac size.' },
      { question_id: 'q_chf_003', correct_option_index: 1, explanation: 'IV furosemide + oxygen is first-line for acute cardiogenic pulmonary oedema.' }
    ]
  },
  {
    id: 'case_derm_003_atopy', sessionId: 'sess_derm_003_atopy', moduleId: 'mod_derm_003', hours: 1.5,
    sessionTitle: 'Canine Atopic Dermatitis — Diagnosis & Allergen Testing',
    sessionDesc: 'Work up a pruritic dog: apply Favrot criteria, understand the exclusionary nature of the atopy diagnosis, and choose the appropriate allergen-identification test.',
    gold: ['atopic', 'atopy', 'allergic', 'allergy', 'environmental', 'hypersensitivity'],
    insight: 'Canine atopic dermatitis is a clinical/exclusionary diagnosis supported by Favrot criteria (onset <3y, indoor, glucocorticoid-responsive pruritus, affected front feet + pinnae). Allergen testing — intradermal skin testing (gold standard) or serum IgE — identifies environmental allergens to guide allergen-specific immunotherapy; it does NOT diagnose atopy. Manage secondary infection and pruritus (oclacitinib, lokivetmab) alongside allergen avoidance.',
    quiz: [
      { question_id: 'q_derm_001', correct_option_index: 0, explanation: 'These are Favrot criteria: young onset, indoor, steroid-responsive pruritus, front feet.' },
      { question_id: 'q_derm_002', correct_option_index: 1, explanation: 'Intradermal skin testing is the gold standard for identifying environmental allergen sensitivities.' }
    ]
  },
  {
    id: 'case_surg_002_fb', sessionId: 'sess_surg_002_fb', moduleId: 'mod_surg_002', hours: 3.0,
    sessionTitle: 'Feline Linear Foreign Body — Recognition & Enterotomy',
    sessionDesc: 'Recognise the radiographic hallmark of a linear foreign body and rehearse the critical intra-operative decision before enterotomy closure.',
    gold: ['foreign body', 'linear', 'obstruction', 'plication', 'intestinal'],
    insight: 'A linear foreign body classically causes intestinal plication/bunching with eccentric gas bubbles, often anchored at the pylorus or sublingually. Retrieval is via enterotomy (sometimes multiple). Before closing ANY incision, assess intestinal viability (colour, peristalsis, bleeding) and resect non-viable bowel; copious lavage and an omental/serosal patch reduce dehiscence risk.',
    quiz: [
      { question_id: 'q_fb_001', correct_option_index: 1, explanation: 'Intestinal plication/bunching is the classic radiographic sign of a linear foreign body.' },
      { question_id: 'q_fb_002', correct_option_index: 1, explanation: 'Intestinal viability must be confirmed at the incision before closure to prevent dehiscence.' }
    ]
  }
];

async function main() {
  for (const c of CASES) {
    await patch(`cpd_cases/${c.id}`, { is_free: true, session_type: 'VT', hours: c.hours }, ['is_free', 'session_type', 'hours']);
    await patch(`cpd_cases/${c.id}/private/reveal`, {
      case_id: c.id, session_type: 'VT', insight_text: c.insight, reference_document_url: null,
      gold_differential_keywords: c.gold, quiz_answers: c.quiz, seeded_errors: [],
      provider_name: 'VetNotes CPD', provider_code: 'VN-CPD-2026', activity_code: c.id, hours_awarded: c.hours, is_free: true
    });
    await patch(`cpd_sessions/${c.sessionId}`, {
      id: c.sessionId, module_id: c.moduleId, title: c.sessionTitle, description: c.sessionDesc,
      session_type: 'VT', duration_minutes: Math.round(c.hours * 60), is_free: true, case_ids: [c.id]
    });
  }
  console.log('catalogue seeded:', CASES.length, 'cases');
}
main();
