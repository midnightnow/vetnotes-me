import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp({
    credential: applicationDefault()
  });
}

const db = getFirestore();

async function seedSessions() {
  console.log('Seeding CPD Sessions...');

  const sessionId = 'sess_rad_thoracic_01';
  const sessionData = {
    id: sessionId,
    module_id: 'mod_rad_thoracic_01',
    title: 'Thoracic Radiology Mastery: Part 1',
    description: 'Comprehensive review of thoracic interpretation, focusing on CHF and airway disease differentials.',
    session_type: 'TYPE_1',
    duration_minutes: 60,
    is_free: true,
    case_ids: ['case_rad_001_chf'],
    topic_categories: ['Clinical', 'Radiology']
  };

  await db.collection('cpd_sessions').doc(sessionId).set(sessionData);
  console.log(`- Seeded Session: ${sessionId}`);

  console.log('Session seeding complete.');
}

seedSessions().catch(console.error);
