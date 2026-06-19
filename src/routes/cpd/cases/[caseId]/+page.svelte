<script lang="ts">
  import { onMount } from 'svelte';
  import type { CPDAttempt, CPDStep, CompetencyId, CompetencyTier } from '$lib/types/cpd';
  import DicomViewer from '$lib/components/DicomViewer.svelte';

  // Data passed from SvelteKit load function (contains caseId and public case metadata)
  export let data: { caseId: string; isLocked: boolean; sessionType: string; publicCase: any };

  let attempt: CPDAttempt | null = null;
  let currentStep: CPDStep = 'STEP_1_INTAKE';
  let isLoading = false;
  let errorMessage = '';

  // Step 2: Human Reasoning input fields
  let qualityNotes = '';
  let abnormalitiesNotes = '';
  let differentialNotes = '';

  // Step 3 & 4: Secure AI Reveal payload
  let aiReportRaw = '';
  let seededErrors: Array<{ id: string; anatomical_zone: string; ai_claim: string }> = [];
  let userDetections: Record<string, { detected: boolean; notes: string }> = {};

  // Step 5: Quiz responses
  let quizResponses: Record<string, number> = {};

  // Completed State: Grading & Credentials
  let evaluationResults: {
    passed: boolean;
    competency_scores: Record<CompetencyId, number>;
    certificate?: { id: string; verification_url: string };
  } | null = null;
  let certificateDetail: { verification_url?: string; provider_veted_code?: string; hours_awarded?: number } | null = null;
  let certificateError = '';

  onMount(async () => {
    await initCpdAttempt();
  });

  // Helper: Retrieve or create attempt
  async function initCpdAttempt() {
    isLoading = true;
    errorMessage = '';
    try {
      const res = await fetch('/api/cpd/attempt/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: data.caseId })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Failed to start attempt');
      
      attempt = result.attempt;
      currentStep = attempt!.current_step;
      
      // Rehydrate state if resuming an active attempt
      if (attempt!.user_reasoning) {
        qualityNotes = attempt!.user_reasoning.quality_assessment_notes;
        abnormalitiesNotes = attempt!.user_reasoning.abnormalities_identified;
        differentialNotes = attempt!.user_reasoning.primary_differential;
      }
    } catch (e: any) {
      errorMessage = e.message;
    } finally {
      isLoading = false;
    }
  }

  // Step 2 Submission
  async function submitReasoning() {
    if (!qualityNotes.trim() || !abnormalitiesNotes.trim() || !differentialNotes.trim()) {
      errorMessage = 'Please complete all diagnostic reasoning fields before locking.';
      return;
    }
    
    isLoading = true;
    errorMessage = '';
    try {
      const res = await fetch('/api/cpd/attempt/submit-reasoning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: attempt?.id,
          user_reasoning: {
            quality_assessment_notes: qualityNotes,
            abnormalities_identified: abnormalitiesNotes,
            primary_differential: differentialNotes
          }
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Submission failed');
      
      currentStep = result.next_step;
    } catch (e: any) {
      errorMessage = e.message;
    } finally {
      isLoading = false;
    }
  }

  // Step 3 Submission (Secure Reveal Gate)
  async function requestReveal() {
    isLoading = true;
    errorMessage = '';
    try {
      const res = await fetch('/api/cpd/attempt/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: attempt?.id })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Reveal request failed');

      aiReportRaw = result.ai_report_raw;
      seededErrors = result.seeded_errors;

      // Initialize verification bindings for Step 4
      seededErrors.forEach(err => {
        userDetections[err.id] = { detected: false, notes: '' };
      });

      currentStep = 'STEP_4_COMPARISON';
    } catch (e: any) {
      errorMessage = e.message; // Captures anti-skip timing failures (e.g. < 120s)
    } finally {
      isLoading = false;
    }
  }

  // Step 4 Submission
  async function submitComparison() {
    isLoading = true;
    errorMessage = '';
    try {
      const formattedDetections = Object.keys(userDetections).map(id => ({
        seeded_error_id: id,
        did_user_detect: userDetections[id].detected,
        user_correction_notes: userDetections[id].notes
      }));

      const res = await fetch('/api/cpd/attempt/submit-comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: attempt?.id,
          user_comparison: {
            detected_seeded_errors: formattedDetections,
            final_synthesized_report: `Calibration complete. Verified by user.`
          }
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Comparison submission failed');
      
      currentStep = 'STEP_5_QUIZ';
    } catch (e: any) {
      errorMessage = e.message;
    } finally {
      isLoading = false;
    }
  }

  // Step 5 Submission (Finalizes, grades, and logs attempt)
  async function submitQuiz() {
    isLoading = true;
    errorMessage = '';
    try {
      const formattedResponses = Object.keys(quizResponses).map(qId => ({
        question_id: qId,
        selected_option_index: quizResponses[qId]
      }));

      const res = await fetch('/api/cpd/attempt/submit-final', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: attempt?.id,
          quiz_responses: formattedResponses
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Scoring transaction failed');

      evaluationResults = {
        passed: result.passed,
        competency_scores: result.competency_scores,
        certificate: result.certificate
      };
      
      currentStep = 'COMPLETED';
      if (result.certificate) {
        await loadCertificateDetail(result.certificate);
      }
    } catch (e: any) {
      errorMessage = e.message;
    } finally {
      isLoading = false;
    }
  }

  async function loadCertificateDetail(certificate: any) {
    certificateDetail = certificate;
    certificateError = '';
  }

  async function claimCertificate() {
    if (!attempt?.id) return;
    isLoading = true;
    certificateError = '';
    try {
      const response = await fetch(`/api/cpd/attempt/${attempt.id}/certificate`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result?.error || 'Unable to load certificate.');
      }
      certificateDetail = result.certificate;
    } catch (e: any) {
      certificateError = e?.message || 'Unable to load certificate.';
    } finally {
      isLoading = false;
    }
  }

  // Helper utility: Display score status levels
  function getTierLabel(score: number): { label: CompetencyTier; class: string } {
    if (score >= 0.80) return { label: 'COMPETENT', class: 'tier-pass' };
    if (score >= 0.60) return { label: 'BORDERLINE', class: 'tier-border' };
    return { label: 'NOT_COMPETENT', class: 'tier-fail' };
  }
</script>

<svelte:head>
  <title>CPD Case — {data.publicCase?.title || 'Clinical Module'} | VetNotes</title>
  <meta name="description" content="Interactive CPD clinical case assessment for veterinary practitioners." />
</svelte:head>

{#if data.isLocked}
  <div class="locked-gate">
    <div class="locked-card">
      <div class="locked-icon">🔒</div>
      <h2>Premium Case</h2>
      <p>Complete Case 1 to unlock the full radiology series.</p>
      <a href="/cpd/cases/case_rad_001_chf" class="btn-unlock">Start Free Case 1</a>
    </div>
  </div>
{:else}
<div class="cpd-layout">
  <!-- ═══════════════════════════════════════════════════════════════════
       LEFT PANEL: Diagnostic Image Viewer (IMAGING sessions only)
       ═══════════════════════════════════════════════════════════════════ -->
  {#if data.sessionType === 'IMAGING'}
  <div class="media-panel">
    <DicomViewer 
      studyId={data.caseId}
      instanceUrls={data.publicCase.raw_images.map(img => img.url)}
      metadata={{
        patientName: `${data.publicCase.signalment.species} (${data.publicCase.signalment.breed})`,
        modality: 'RAD',
        bodyPart: 'THORAX'
      }}
    />
  </div>
  {/if}

  <!-- ═══════════════════════════════════════════════════════════════════
       RIGHT PANEL: Step-Progression Panel
       ═══════════════════════════════════════════════════════════════════ -->
  <div class="progress-panel">
    <header class="progress-header">
      <span class="badge case-badge">Case {data.publicCase.sequence_number}</span>
      <h2>{data.publicCase.title}</h2>
      <div class="stepper">
        <span class:active={currentStep === 'STEP_1_INTAKE' || currentStep === 'STEP_2_REASONING'}>1. Interpret</span>
        <span class="stepper-divider">→</span>
        <span class:active={currentStep === 'STEP_3_REVEAL' || currentStep === 'STEP_4_COMPARISON'}>2. Calibrate</span>
        <span class="stepper-divider">→</span>
        <span class:active={currentStep === 'STEP_5_QUIZ'}>3. Verify</span>
        <span class="stepper-divider">→</span>
        <span class:active={currentStep === 'COMPLETED'}>4. Result</span>
      </div>
    </header>

    {#if errorMessage}
      <div class="alert error-alert">{errorMessage}</div>
    {/if}

    <div class="step-content">
      <!-- ─── STEP 1: CLINICAL INTAKE ─────────────────────────────── -->
      {#if currentStep === 'STEP_1_INTAKE'}
        <div class="step-body">
          <h3>Step 1: Clinical Case Presentation</h3>
          <div class="card clinical-card">
            <p><strong>Signalment:</strong> {data.publicCase.signalment.species} ({data.publicCase.signalment.breed}), {data.publicCase.signalment.age_years}yo, {data.publicCase.signalment.sex}, {data.publicCase.signalment.weight_kg}kg</p>
            <p><strong>History:</strong> {data.publicCase.clinical_history}</p>
            <p><strong>Physical Exam:</strong> {data.publicCase.physical_examination}</p>
          </div>
          <p class="instruction">Review the clinical context and diagnostic images carefully before proceeding to blind analysis.</p>
          <button class="btn btn-primary" on:click={() => currentStep = 'STEP_2_REASONING'}>Begin Case Analysis</button>
        </div>
      {/if}

      <!-- ─── STEP 2: BLIND DIAGNOSTIC REASONING ─────────────────── -->
      {#if currentStep === 'STEP_2_REASONING'}
        <div class="step-body">
          <h3>Step 2: Blind Diagnostic Reasoning</h3>
          <p class="instruction">Analyze the radiographs to the left and document your findings before revealing AI interpretations.</p>
          
          <div class="form-group">
            <label for="quality">1. Radiographic Quality Assessment (COMP_1)</label>
            <textarea id="quality" bind:value={qualityNotes} placeholder="Assess positioning, exposure, centering, and respiratory phase constraints..."></textarea>
          </div>

          <div class="form-group">
            <label for="structure">2. Systematic Thoracic Review (COMP_2)</label>
            <textarea id="structure" bind:value={abnormalitiesNotes} placeholder="Describe cardiac silhouette, pulmonary parenchyma, pleural space, and osseous structures..."></textarea>
          </div>

          <div class="form-group">
            <label for="pattern">3. Primary & Secondary Differentials (COMP_3)</label>
            <textarea id="pattern" bind:value={differentialNotes} placeholder="Document your structured clinical diagnoses and pattern definitions..."></textarea>
          </div>

          <button class="btn btn-primary" disabled={isLoading} on:click={submitReasoning}>
            {#if isLoading}Locking...{:else}Lock Findings & Proceed{/if}
          </button>
        </div>
      {/if}

      <!-- ─── STEP 3: REVEAL GATE ─────────────────────────────────── -->
      {#if currentStep === 'STEP_3_REVEAL'}
        <div class="step-body centering">
          <h3>Step 3: Reveal AI Assessment</h3>
          <div class="reveal-gate-card">
            <p class="instruction">Your reasoning is locked. The system is ready to cross-analyze your inputs with VetNotes AI automated findings.</p>
            <p class="timing-note">⏱ A minimum 2-minute image review period is enforced for assessment integrity.</p>
          </div>
          <button class="btn btn-reveal" disabled={isLoading} on:click={requestReveal}>
            {#if isLoading}Requesting...{:else}Reveal AI Report & Seeded Errors{/if}
          </button>
        </div>
      {/if}

      <!-- ─── STEP 4: ADVERSARIAL CALIBRATION ─────────────────────── -->
      {#if currentStep === 'STEP_4_COMPARISON'}
        <div class="step-body">
          <h3>Step 4: AI Calibration & Verification</h3>
          <p class="instruction">Compare your original diagnostic findings side-by-side with the AI assistant. Identify and correct automated inaccuracies.</p>
          
          <div class="comparison-split">
            <div class="half-card human-card">
              <h4>Your Reasoning</h4>
              <div class="reasoning-content">
                <p><strong>Quality:</strong> {qualityNotes}</p>
                <p><strong>Findings:</strong> {abnormalitiesNotes}</p>
                <p><strong>Differentials:</strong> {differentialNotes}</p>
              </div>
            </div>
            <div class="half-card ai-card">
              <h4>AI Generated Output</h4>
              <pre class="ai-report">{aiReportRaw}</pre>
            </div>
          </div>

          <div class="calibration-area">
            <h4>Seeded Error Evaluation (COMP_5)</h4>
            <p class="instruction">For each AI claim below, determine whether it constitutes a diagnostic error. If so, provide your clinical justification.</p>
            {#each seededErrors as err}
              <div class="error-validation-card">
                <p class="zone-label"><strong>System Zone:</strong> {err.anatomical_zone.replace(/_/g, ' ').toUpperCase()}</p>
                <p class="claim"><strong>AI Claim:</strong> "{err.ai_claim}"</p>
                <label class="checkbox-container">
                  <input type="checkbox" bind:checked={userDetections[err.id].detected} />
                  <span>I classify this specific AI finding as a <strong>Diagnostic Error / Misinterpretation</strong>.</span>
                </label>
                {#if userDetections[err.id].detected}
                  <textarea 
                    bind:value={userDetections[err.id].notes} 
                    placeholder="Describe the clinical/radiological ground-truth correcting this claim..."
                  ></textarea>
                {/if}
              </div>
            {/each}
          </div>

          <button class="btn btn-primary" disabled={isLoading} on:click={submitComparison}>
            {#if isLoading}Submitting...{:else}Confirm Calibration & Proceed{/if}
          </button>
        </div>
      {/if}

      <!-- ─── STEP 5: CLINICAL KNOWLEDGE QUIZ ─────────────────────── -->
      {#if currentStep === 'STEP_5_QUIZ'}
        <div class="step-body">
          <h3>Step 5: Clinical Knowledge Verification</h3>
          <p class="instruction">Answer the following clinical questions to demonstrate your understanding of the case findings and appropriate management.</p>
          {#each data.publicCase.quiz_questions as q, qIdx}
            <div class="quiz-card">
              <p class="question"><strong>Question {qIdx + 1}:</strong> {q.question}</p>
              <div class="options">
                {#each q.options as opt, idx}
                  <label class="option-label" class:selected={quizResponses[q.id] === idx}>
                    <input type="radio" name={q.id} value={idx} bind:group={quizResponses[q.id]} />
                    <span>{opt}</span>
                  </label>
                {/each}
              </div>
            </div>
          {/each}
          <button class="btn btn-primary" disabled={isLoading} on:click={submitQuiz}>
            {#if isLoading}Grading...{:else}Grade & Finalize Module{/if}
          </button>
        </div>
      {/if}

      <!-- ─── COMPLETED: SCORECARD & CERTIFICATE ─────────────────── -->
      {#if currentStep === 'COMPLETED' && evaluationResults}
        <div class="step-body centering">
          <div class="result-banner" class:passed={evaluationResults.passed} class:failed={!evaluationResults.passed}>
            {#if evaluationResults.passed}
              <div class="result-icon">✓</div>
              <h2>Competency Achieved</h2>
              <p>You have successfully demonstrated clinical competency across all evaluated parameters.</p>
            {:else}
              <div class="result-icon">⟳</div>
              <h2>Developing Competency</h2>
              <p>Review the expert consensus and retake the case calibration to achieve your CPD points.</p>
            {/if}
          </div>

          <div class="competency-matrix">
            <h3>Competency Scorecard</h3>
            <div class="matrix-grid">
              {#each Object.entries(evaluationResults.competency_scores) as [compKey, score]}
                {@const tier = getTierLabel(score)}
                <div class="matrix-row">
                  <span class="comp-label">{compKey}</span>
                  <div class="score-bar">
                    <div class="score-fill {tier.class}" style="width: {score * 100}%"></div>
                  </div>
                  <span class="badge {tier.class}">{tier.label}</span>
                </div>
              {/each}
            </div>
          </div>

          {#if evaluationResults.passed}
            {#if evaluationResults.certificate}
              <a href={evaluationResults.certificate.verification_url} class="btn btn-success" target="_blank">
                Download Verifiable CPD Certificate
              </a>
            {:else}
              <button class="btn btn-primary" disabled={isLoading} on:click={claimCertificate}>
                {#if isLoading}Verifying attempt...{:else}Claim Certificate{/if}
              </button>
            {/if}
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  /* ═══════════════════════════════════════════════════════════════════
     LAYOUT: Split-panel diagnostic workspace
     ═══════════════════════════════════════════════════════════════════ */
  .cpd-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    height: 100vh;
    overflow: hidden;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }

  /* ─── Left Panel: Diagnostic Image Viewer ─────────────────────── */
  .media-panel {
    border-right: 1px solid #1e293b;
    display: flex;
    flex-direction: column;
    background: #0f172a;
    color: #e2e8f0;
  }
  .viewer-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #1e293b;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .viewer-header h3 {
    margin: 0;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
  }
  .tabs {
    display: flex;
    gap: 0.5rem;
  }
  .tab-btn {
    background: #1e293b;
    color: #94a3b8;
    border: 1px solid #334155;
    padding: 0.4rem 0.75rem;
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .tab-btn:hover {
    background: #334155;
    color: #e2e8f0;
  }
  .tab-btn.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }
  .viewer-body {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 1rem;
    background: #000;
    position: relative;
  }
  .image-container {
    transition: transform 0.1s ease-out;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .viewer-body img {
    max-height: 90vh;
    max-width: 100%;
    object-fit: contain;
    border-radius: 4px;
  }

  .viewer-controls {
    background: #1e293b;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    border-top: 1px solid #334155;
  }
  .control-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .control-group label {
    font-size: 0.7rem;
    color: #94a3b8;
    text-transform: uppercase;
    font-weight: 700;
  }
  .control-group input {
    width: 100%;
    accent-color: #3b82f6;
  }
  .flex-between {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .btn-text {
    background: none;
    border: none;
    color: #3b82f6;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
  }

  /* ─── Right Panel: Step Progression ────────────────────────────── */
  .progress-panel {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    background: #fafbfc;
  }
  .progress-header {
    padding: 1.5rem 2rem 1rem;
    border-bottom: 1px solid #e2e8f0;
    background: white;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .progress-header h2 {
    margin: 0.5rem 0;
    font-size: 1.25rem;
    color: #0f172a;
  }
  .case-badge {
    background: #3b82f6;
    color: white;
    padding: 0.2rem 0.6rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* ─── Stepper ──────────────────────────────────────────────────── */
  .stepper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.75rem;
    font-size: 0.8rem;
    color: #94a3b8;
  }
  .stepper span.active {
    color: #3b82f6;
    font-weight: 700;
  }
  .stepper-divider {
    color: #cbd5e1;
    font-size: 0.7rem;
  }

  /* ─── Step Content Area ────────────────────────────────────────── */
  .step-content {
    flex: 1;
    padding: 1.5rem 2rem 2rem;
  }
  .step-body h3 {
    color: #0f172a;
    font-size: 1.1rem;
    margin-bottom: 0.75rem;
  }
  .instruction {
    color: #64748b;
    font-size: 0.9rem;
    line-height: 1.5;
    margin-bottom: 1.25rem;
  }
  .centering {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  /* ─── Alerts ───────────────────────────────────────────────────── */
  .alert.error-alert {
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin: 0 2rem 1rem;
    font-size: 0.875rem;
  }

  /* ─── Cards ────────────────────────────────────────────────────── */
  .clinical-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.25rem;
    margin-bottom: 1.25rem;
  }
  .clinical-card p {
    margin: 0.4rem 0;
    line-height: 1.6;
    color: #334155;
    font-size: 0.9rem;
  }

  /* ─── Forms ────────────────────────────────────────────────────── */
  .form-group {
    margin-bottom: 1.25rem;
    display: flex;
    flex-direction: column;
  }
  .form-group label {
    font-size: 0.85rem;
    font-weight: 600;
    color: #334155;
    margin-bottom: 0.35rem;
  }
  .form-group textarea,
  .error-validation-card textarea {
    width: 100%;
    min-height: 90px;
    padding: 0.65rem;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    font-size: 0.875rem;
    font-family: inherit;
    resize: vertical;
    transition: border-color 0.2s ease;
    box-sizing: border-box;
  }
  .form-group textarea:focus,
  .error-validation-card textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  /* ─── Reveal Gate ──────────────────────────────────────────────── */
  .reveal-gate-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    max-width: 480px;
  }
  .timing-note {
    font-size: 0.8rem;
    color: #a16207;
    background: #fefce8;
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    margin-top: 0.75rem;
  }
  .btn-reveal {
    background: #7c3aed;
    color: white;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
  }
  .btn-reveal:hover:not(:disabled) {
    background: #6d28d9;
  }
  .btn-reveal:disabled {
    background: #c4b5fd;
    cursor: not-allowed;
  }

  /* ─── Comparison Split ─────────────────────────────────────────── */
  .comparison-split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  .half-card {
    padding: 1rem;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    font-size: 0.85rem;
  }
  .half-card h4 {
    margin: 0 0 0.75rem;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .human-card {
    background: #f0fdf4;
    border-color: #bbf7d0;
  }
  .human-card h4 { color: #15803d; }
  .ai-card {
    background: #fefce8;
    border-color: #fde68a;
  }
  .ai-card h4 { color: #a16207; }
  .reasoning-content p {
    margin: 0.3rem 0;
    color: #334155;
    line-height: 1.5;
  }
  .ai-report {
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.8rem;
    color: #78350f;
    margin: 0;
    line-height: 1.6;
  }

  /* ─── Error Validation Cards ───────────────────────────────────── */
  .calibration-area h4 {
    margin-bottom: 0.75rem;
    color: #0f172a;
  }
  .error-validation-card {
    background: #fff;
    border: 1px solid #fecaca;
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
  }
  .zone-label {
    font-size: 0.8rem;
    color: #64748b;
    margin-bottom: 0.25rem;
  }
  .claim {
    font-size: 0.9rem;
    color: #1e293b;
    font-style: italic;
    margin-bottom: 0.75rem;
  }
  .checkbox-container {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    cursor: pointer;
    margin-bottom: 0.75rem;
  }
  .checkbox-container input[type="checkbox"] {
    margin-top: 0.2rem;
  }
  .checkbox-container span {
    font-size: 0.875rem;
    color: #334155;
  }

  /* ─── Quiz Cards ───────────────────────────────────────────────── */
  .quiz-card {
    background: white;
    border: 1px solid #e2e8f0;
    padding: 1.25rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }
  .question {
    font-size: 0.9rem;
    color: #0f172a;
    margin-bottom: 0.75rem;
    line-height: 1.5;
  }
  .options {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .option-label {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    font-size: 0.85rem;
    color: #334155;
    line-height: 1.4;
  }
  .option-label:hover {
    border-color: #93c5fd;
    background: #f0f7ff;
  }
  .option-label.selected {
    border-color: #3b82f6;
    background: #eff6ff;
    font-weight: 500;
  }
  .option-label input[type="radio"] {
    margin-top: 0.15rem;
  }

  /* ─── Results Banner ───────────────────────────────────────────── */
  .result-banner {
    padding: 2rem;
    border-radius: 12px;
    margin-bottom: 1.5rem;
    width: 100%;
    max-width: 500px;
  }
  .result-banner.passed {
    background: linear-gradient(135deg, #dcfce7, #bbf7d0);
    border: 1px solid #86efac;
  }
  .result-banner.failed {
    background: linear-gradient(135deg, #fef9c3, #fde68a);
    border: 1px solid #fcd34d;
  }
  .result-icon {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
  }
  .result-banner h2 {
    margin: 0.5rem 0;
    color: #0f172a;
  }
  .result-banner p {
    color: #334155;
    font-size: 0.9rem;
  }

  /* ─── Competency Matrix ────────────────────────────────────────── */
  .competency-matrix {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.25rem;
    margin-bottom: 1.5rem;
    width: 100%;
    max-width: 500px;
  }
  .competency-matrix h3 {
    margin: 0 0 1rem;
    font-size: 0.95rem;
  }
  .matrix-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f1f5f9;
  }
  .matrix-row:last-child {
    border-bottom: none;
  }
  .comp-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #475569;
    width: 60px;
    flex-shrink: 0;
  }
  .score-bar {
    flex: 1;
    height: 8px;
    background: #f1f5f9;
    border-radius: 4px;
    overflow: hidden;
  }
  .score-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.6s ease;
  }
  .score-fill.tier-pass { background: #22c55e; }
  .score-fill.tier-border { background: #eab308; }
  .score-fill.tier-fail { background: #ef4444; }

  /* ─── Badges ───────────────────────────────────────────────────── */
  .badge {
    padding: 0.2rem 0.5rem;
    font-size: 0.7rem;
    font-weight: 700;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    flex-shrink: 0;
  }
  .tier-pass { background: #dcfce7; color: #15803d; }
  .tier-border { background: #fef9c3; color: #a16207; }
  .tier-fail { background: #fee2e2; color: #b91c1c; }

  /* ─── Buttons ──────────────────────────────────────────────────── */
  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
    display: inline-block;
    text-align: center;
  }
  .btn-primary {
    background: #3b82f6;
    color: white;
  }
  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }
  .btn-primary:disabled {
    background: #93c5fd;
    cursor: not-allowed;
  }
  .btn-success {
    background: #22c55e;
    color: white;
  }
  .btn-success:hover {
    background: #16a34a;
  }

  /* ─── Locked Gate ─────────────────────────────────────────────── */
  .locked-gate {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: #f8fafc;
  }
  .locked-card {
    text-align: center;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 3rem 2.5rem;
    max-width: 400px;
  }
  .locked-icon { font-size: 2.5rem; margin-bottom: 1rem; }
  .locked-card h2 { color: #0f172a; margin: 0 0 0.5rem; }
  .locked-card p { color: #64748b; font-size: 0.9rem; margin-bottom: 1.5rem; }
  .btn-unlock {
    display: inline-block;
    background: #3b82f6;
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-weight: 600;
    font-size: 0.9rem;
    text-decoration: none;
  }
  .btn-unlock:hover { background: #2563eb; }
</style>
{/if}
