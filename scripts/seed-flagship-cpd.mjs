/**
 * Seed the flagship free CPD case so the funnel actually functions.
 *
 * Makes `case_rad_001_chf` a completable, free, real clinical case:
 *   - patches the public case doc: is_free=true, session_type='VT'
 *   - creates private/reveal (answer key + gold differential + expert insight)
 *   - creates a cpd_session (so attendance + the completion record work; hours
 *     match the case's 2.5h)
 *
 * Idempotent. Run:  GOOGLE_TOKEN=$(gcloud auth print-access-token) node scripts/seed-flagship-cpd.mjs
 * Writes to project `vetsorcery` Firestore (where CPD data lives).
 */
const TOKEN = process.env.GOOGLE_TOKEN;
if (!TOKEN) { console.error('Set GOOGLE_TOKEN=$(gcloud auth print-access-token)'); process.exit(1); }
const PROJECT = 'vetsorcery';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

// Minimal JS -> Firestore typed-value encoder.
function enc(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
  throw new Error('unencodable: ' + typeof v);
}
const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));

async function patch(path, obj, mask) {
  const q = mask.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const r = await fetch(`${BASE}/${path}?${q}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: fields(obj) })
  });
  console.log(`PATCH ${path} -> ${r.status}`);
  if (!r.ok) console.error(await r.text());
}
async function put(path, obj) {
  const r = await fetch(`${BASE}/${path}`, {
    method: 'PATCH', // PATCH with no mask == create/replace at a known id
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: fields(obj) })
  });
  console.log(`PUT ${path} -> ${r.status}`);
  if (!r.ok) console.error(await r.text());
}

const INSIGHT =
  'This patient shows cardiogenic pulmonary oedema secondary to left-sided congestive heart failure. ' +
  'Key findings: generalised cardiomegaly with an elevated vertebral heart score (VHS > 10.5), left atrial ' +
  'enlargement dorsally displacing the carina/left mainstem bronchus, and a caudodorsal interstitial-to-alveolar ' +
  'pattern with pulmonary venous distension. The commonest underlying cause in older small-breed dogs is myxomatous ' +
  'mitral valve disease (MMVD). First-line emergency management is IV furosemide with oxygen; pimobendan and ' +
  'echocardiography follow stabilisation.';

async function main() {
  // 1. Public case doc: free + VT flow (empty image URLs -> no DICOM viewer).
  await patch('cpd_cases/case_rad_001_chf', { is_free: true, session_type: 'VT' }, ['is_free', 'session_type']);

  // 2. Secure reveal (answer key + gold differential + expert insight).
  await put('cpd_cases/case_rad_001_chf/private/reveal', {
    case_id: 'case_rad_001_chf',
    session_type: 'VT',
    insight_text: INSIGHT,
    reference_document_url: null,
    gold_differential_keywords: ['congestive', 'chf', 'cardiogenic', 'oedema', 'edema', 'mitral', 'mmvd', 'left atrial'],
    quiz_answers: [
      { question_id: 'q_chf_001', correct_option_index: 1, explanation: 'Cardiogenic pulmonary oedema — the venous congestion + LA enlargement pattern is classic for left-sided CHF.' },
      { question_id: 'q_chf_002', correct_option_index: 1, explanation: 'Vertebral heart score (VHS) is the standard radiographic quantifier of cardiac size.' },
      { question_id: 'q_chf_003', correct_option_index: 1, explanation: 'IV furosemide plus oxygen is first-line for acute cardiogenic pulmonary oedema.' }
    ],
    seeded_errors: [],
    provider_name: 'VetNotes CPD',
    provider_code: 'VN-CPD-2026',
    activity_code: 'case_rad_001_chf',
    hours_awarded: 2.5,
    is_free: true
  });

  // 3. Session wrapper (attendance + completion record; 150 min == 2.5h matches the case).
  await put('cpd_sessions/sess_rad_001_chf', {
    id: 'sess_rad_001_chf',
    module_id: 'mod_rad_001',
    title: 'Canine Congestive Heart Failure — Thoracic Radiography',
    description: 'Interpret a thoracic radiograph of a dog in respiratory distress; reason to a differential, calibrate against the expert read, and verify with a clinical-decision quiz.',
    session_type: 'VT',
    duration_minutes: 150,
    is_free: true,
    case_ids: ['case_rad_001_chf']
  });

  console.log('done.');
}
main();
