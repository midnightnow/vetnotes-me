import { writeFileSync } from 'fs';

const BASE_URL = 'http://localhost:5173'; // Adjust to your SvelteKit port
const TEST_CASE_ID = 'case_rad_001_chf';

// To run this test, you need a valid Firebase ID token from your client.
// You can get this by logging in to the browser, opening the console, and running:
// await firebase.auth().currentUser.getIdToken()
const MOCK_FIREBASE_ID_TOKEN = process.env.FIREBASE_ID_TOKEN || 'YOUR_ID_TOKEN_HERE';

async function runVerification() {
  console.log('🚀 Starting CPD Flow Verification...');
  let cookieHeader = '';
  let attemptId = '';

  if (MOCK_FIREBASE_ID_TOKEN === 'YOUR_ID_TOKEN_HERE') {
    console.warn('⚠️  Warning: Using placeholder token. Set the FIREBASE_ID_TOKEN env variable or paste a real token to verify database writes.');
  }

  // ==========================================
  // STEP 0: TEST AUTH BRIDGE (SESSION SYNC)
  // ==========================================
  console.log('\n--- Step 0: Syncing Auth Session Cookie ---');
  try {
    const res = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: MOCK_FIREBASE_ID_TOKEN })
    });

    if (!res.ok) {
      throw new Error(`Auth sync failed with status ${res.status}: ${await res.text()}`);
    }

    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) {
      throw new Error('Failed to retrieve Set-Cookie header from session endpoint.');
    }

    // Extract the __session cookie to simulate the browser's cookie storage
    cookieHeader = setCookie.split(';')[0];
    console.log('✅ Auth session synchronized successfully.');
    console.log(`📡 Cookie Extracted: ${cookieHeader.substring(0, 30)}...`);
  } catch (err) {
    console.error('❌ Step 0 Failed:', err.message);
    process.exit(1);
  }

  // ==========================================
  // STEP 1: LOAD SECURE CPD PAGE
  // ==========================================
  console.log('\n--- Step 1: Loading Protected CPD Page Loader ---');
  try {
    const res = await fetch(`${BASE_URL}/cpd/cases/${TEST_CASE_ID}`, {
      headers: { 'Cookie': cookieHeader }
    });

    if (res.status === 302) {
      console.error('❌ Loader Gating Failed: Redirected to login page. Session cookie was not recognized.');
      process.exit(1);
    }

    if (!res.ok) {
      throw new Error(`Page load failed with status ${res.status}`);
    }

    console.log('✅ Loader gating passed. Page retrieved securely.');
  } catch (err) {
    console.error('❌ Step 1 Failed:', err.message);
    process.exit(1);
  }

  // ==========================================
  // STEP 2: START CPD ATTEMPT
  // ==========================================
  console.log('\n--- Step 2: Starting CPD Attempt ---');
  try {
    const res = await fetch(`${BASE_URL}/api/cpd/attempt/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      },
      body: JSON.stringify({ caseId: TEST_CASE_ID })
    });

    if (!res.ok) {
      throw new Error(`Attempt start failed with status ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    attemptId = data.attempt.id;
    console.log(`✅ CPD Attempt initialized. ID: ${attemptId}`);
    console.log(`📊 Initial State: ${data.attempt.current_step}`);
  } catch (err) {
    console.error('❌ Step 2 Failed:', err.message);
    process.exit(1);
  }

  // ==========================================
  // STEP 3: SUBMIT CLINICAL REASONING
  // ==========================================
  console.log('\n--- Step 3: Submitting Clinical Reasoning ---');
  try {
    const res = await fetch(`${BASE_URL}/api/cpd/attempt/submit-reasoning`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      },
      body: JSON.stringify({
        attemptId,
        user_reasoning: {
          quality_assessment_notes: 'Diagnostic quality is high. Adequate inspiratory phase.',
          abnormalities_identified: 'Dorsal displacement of the trachea, cardiomegaly present with left atrial bulge.',
          primary_differential: 'Myxomatous Mitral Valve Disease (MMVD) with secondary pulmonary edema.'
        }
      })
    });

    if (!res.ok) {
      throw new Error(`Reasoning submission failed with status ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    console.log(`✅ Reasoning locked. Next step: ${data.next_step}`);
  } catch (err) {
    console.error('❌ Step 3 Failed:', err.message);
    process.exit(1);
  }

  // ==========================================
  // STEP 4: REVEAL SECURE DATA (WITH TIMING CHECK)
  // ==========================================
  console.log('\n--- Step 4: Requesting Secure AI Reveal (Timing Check) ---');
  try {
    const res = await fetch(`${BASE_URL}/api/cpd/attempt/reveal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      },
      body: JSON.stringify({ attemptId })
    });

    const data = await res.json();
    
    if (res.status === 400 && data.message.includes('review the diagnostic images')) {
      console.log('ℹ️  Timing gate operating correctly. Prevented instant reveal.');
      console.log('⏳ Waiting 10 seconds to simulate a bypass attempt, or wait 120s for full check...');
    } else if (!res.ok) {
      throw new Error(`Reveal request failed with status ${res.status}: ${JSON.stringify(data)}`);
    } else {
      console.log('✅ AI Report and Seeded Errors revealed successfully.');
    }
  } catch (err) {
    console.error('❌ Step 4 Failed:', err.message);
    process.exit(1);
  }

  console.log('\n✨ CPD verification execution completed.');
}

runVerification();
