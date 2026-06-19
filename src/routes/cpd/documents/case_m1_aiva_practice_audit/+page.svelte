<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageData } from './$types';

  export let data: PageData;
  let notes = $state('');

  onMount(() => {
    notes = '';
  });
</script>

<div class="m1-detail">
  <header>
    <span class="badge">Module 1</span>
    <h1>The AIVA Practice Audit</h1>
    <p class="lede">
      Use VetSorcery to map the AIVA Standard onto your own workflow.
      Complete the audit and claim verifiable CPD hours in under 15 minutes.
    </p>
  </header>

  <section class="m1-body">
    <h2>Course Syllabus</h2>
    <ol class="syllabus-list">
      <li>Define the statutory standard for contemporaneous clinical records.</li>
      <li>Calculate your own mechanical documentation burden.</li>
      <li>Run the AIVA Practice Audit workflow in VetSorcery.</li>
      <li>Review the AI-generated SOAP note and artisanal voice check.</li>
      <li>Complete the knowledge verification and claim your certificate.</li>
    </ol>

    <h2>Learning Objectives</h2>
    <ul class="objectives-list">
      <li>Identify documentation time loss and its clinical impact.</li>
      <li>Demonstrate how AIVA standards ensure completeness and accuracy.</li>
      <li>Use VetSorcery to produce a verifiable audit loop.</li>
    </ul>

    <h2>Instructor</h2>
    <div class="instructor-card">
      <h3>Dallas McMillan</h3>
      <p>
        25 years clinical experience | Molecular biologist | Founder of AIVA and VetSorcery.
        Specialises in automation, infectious disease, and restoring cognitive surplus
        to busy practitioners.
      </p>
    </div>

    <h2>Audit Reflection</h2>
    <textarea
      class="audit-textarea"
      placeholder="Paste or write your reflective notes on the Module 1 audit..."
      bind:value={notes}
    ></textarea>

    <div class="actions">
      <a class="cta" href={`/cpd/cases/${data.caseId}`}>Start module</a>
      <a class="link" href="/cpd/documents">Back to documents</a>
    </div>
  </section>
</div>
