<script lang="ts">
  import { onMount } from 'svelte';

  export let data;

  let docs = $state<any[]>([]);
  let loading = $state(true);

  onMount(async () => {
    try {
      const res = await fetch('/api/cpd/cases');
      if (res.ok) {
        const payload = await res.json();
        docs = payload.cases || [];
      }
    } catch (err) {
      console.error('Failed to fetch CPD cases', err);
    } finally {
      loading = false;
    }
  });

  function getDocumentLabel(doc: any) {
    return doc?.title || doc?.id || 'Untitled document';
  }
</script>

{#if loading}
  <div class="loading-state">Loading documents...</div>
{:else if docs.length === 0}
  <div class="empty-state">No documents published yet. Check back soon.</div>
{:else}
  <div class="doc-grid">
    {#each docs as doc}
      <article class="doc-card">
        <header>
          <span class="doc-type">{(doc?.session_type || 'IMAGING').toUpperCase()}</span>
          <h2>{getDocumentLabel(doc)}</h2>
        </header>
        <p class="doc-summary">
          {doc?.description || 'This module covers the clinical standard mapped from the AIVA Academy framework.'}
        </p>
        <footer>
          <a href={`/cpd/documents/${doc.id}`} class="doc-link">Read case</a>
        </footer>
      </article>
    {/each}
  </div>
{/if}
