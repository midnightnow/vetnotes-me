<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let selectedCaseIndex = $state(-1);
</script>

<svelte:head>
  <title>{data.session.title} | VetNotes CPD Academy</title>
</svelte:head>

<div class="space-y-8">
  <div>
    <h2 class="text-2xl font-bold mb-2">{data.session.title}</h2>
    <p class="opacity-60 mb-4">{data.session.description}</p>

    <div class="flex flex-wrap gap-3 text-xs">
      <span class="px-2 py-1 border rounded">{data.session.session_type}</span>
      {#if data.session.duration_minutes}
        <span class="px-2 py-1 border rounded">{data.session.duration_minutes} min</span>
      {/if}
    </div>
  </div>

  <section>
    <h3 class="text-lg font-semibold mb-3">Cases in This Module</h3>
    <ul class="space-y-3">
      {#each data.cases as caseItem, idx}
        {@const isSelected = selectedCaseIndex === idx}
        <li>
          <button
            class="text-left w-full rounded border p-3 hover:border-white/20 transition-colors {isSelected ? 'border-white/20' : ''}"
            onclick={() => (selectedCaseIndex = idx)}
          >
            <div class="font-medium">{caseItem.title}</div>
            <div class="text-sm opacity-60 mt-1">Sequence {caseItem.sequence_number}</div>
          </button>
        </li>
      {/each}
    </ul>

    {#if selectedCaseIndex >= 0}
      {@const selectedCase = data.cases[selectedCaseIndex]}
      <div class="mt-6 border rounded p-4 space-y-3">
        <h4 class="text-lg font-bold">{selectedCase.title}</h4>
        <p class="opacity-80">{selectedCase.clinical_history}</p>
        <div>
          <span class="text-xs font-bold uppercase opacity-60">Signalment</span>
          <div class="text-sm mt-1">
            {selectedCase.signalment.species}
            {selectedCase.signalment.breed ? `• ${selectedCase.signalment.breed}` : ''}
          </div>
        </div>
      </div>
    {/if}
  </section>
</div>
