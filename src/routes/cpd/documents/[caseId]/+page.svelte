<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>{data.document?.title || 'CPD Document'} | VetNotes</title>
</svelte:head>

<div class="case-detail">
  <header class="case-header">
    <h1>{data.document?.title}</h1>
    <span class="badge">{(data.document?.session_type || 'IMAGING').toUpperCase()}</span>
  </header>

  <section class="case-body">
    <p class="description">{data.document?.description}</p>

    <ul class="module-meta">
      <li><strong>Session Type:</strong> {data.document?.session_type || 'IMAGING'}</li>
      <li><strong>Hours Awarded:</strong> {data.document?.hours_awarded ?? 0}</li>
      <li><strong>Provider:</strong> {data.document?.provider_name || 'VetNotes Academy'}</li>
    </ul>
  </section>

  <footer class="case-actions">
    <a href={`/cpd/cases/${data.caseId}`} class="btn btn-primary">Start Module</a>
  </footer>
</div>

<style>
  .case-detail {
    max-width: 720px;
    margin: 2rem auto;
    padding: 2rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
  }
  .case-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  .case-header h1 {
    margin: 0;
    font-size: 1.5rem;
    color: #0f172a;
  }
  .badge {
    background: #3b82f6;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }
  .description {
    color: #334155;
    line-height: 1.6;
    margin-bottom: 1.5rem;
  }
  .module-meta {
    list-style: none;
    padding: 0;
    margin: 0 0 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .module-meta li {
    font-size: 0.9rem;
    color: #475569;
  }
  .module-meta strong {
    color: #0f172a;
    margin-right: 0.5rem;
  }
  .btn {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: background 0.2s ease;
  }
  .btn-primary {
    background: #3b82f6;
    color: white;
  }
  .btn-primary:hover {
    background: #2563eb;
  }
</style>
