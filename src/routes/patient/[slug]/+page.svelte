<script lang="ts">
  import type { VetClinicalData } from '$lib/types/vet-format';
  import type { PageData } from './$types';

  export let data: PageData;
  const patientContext: VetClinicalData = data.patientContext;
</script>

<div class="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
    
    <!-- HEADER -->
    <div class="bg-blue-600 px-8 py-6 text-white text-center">
        <h1 class="text-3xl font-bold tracking-tight">VetNotes</h1>
        <p class="text-blue-100 mt-2">Clinical Consultation Record • Privacy-First</p>
    </div>

    <div class="p-8">
        <!-- Patient Info -->
        <div class="mb-10 text-center">
            <h2 class="text-3xl font-bold text-gray-900 mb-2">
                {patientContext.patient.name} ({patientContext.patient.species})
            </h2>
            <p class="text-gray-500 uppercase tracking-widest text-sm font-semibold">
                {patientContext.patient.breed} • Patient ID: {patientContext.patient.id}
            </p>
        </div>
        
        <!-- SOAP Record -->
        <div class="space-y-8">
            <section>
                <h3 class="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3 border-b border-blue-100 pb-1">Subjective</h3>
                <p class="text-gray-700 leading-relaxed">{patientContext.soap.subjective}</p>
            </section>

            <section>
                <h3 class="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3 border-b border-blue-100 pb-1">Objective</h3>
                <p class="text-gray-700 leading-relaxed">{patientContext.soap.objective}</p>
            </section>

            <section>
                <h3 class="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3 border-b border-blue-100 pb-1">Assessment</h3>
                <p class="text-gray-700 leading-relaxed">{patientContext.soap.assessment}</p>
            </section>

            <section>
                <h3 class="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3 border-b border-blue-100 pb-1">Plan</h3>
                <p class="text-gray-700 leading-relaxed">{patientContext.soap.plan}</p>
            </section>
        </div>

        {#if patientContext.charges.length > 0}
        <div class="mt-12 bg-gray-50 rounded-xl p-6 border border-gray-100">
            <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Clinical Considerations</h4>
            <ul class="grid grid-cols-2 gap-3">
                {#each patientContext.charges as charge}
                <li class="flex items-center text-sm text-gray-600">
                    <span class="w-1.5 h-1.5 rounded-full bg-green-500 mr-2"></span>
                    {charge}
                </li>
                {/each}
            </ul>
        </div>
        {/if}
        
        <!-- Footer -->
        <div class="mt-16 border-t border-gray-100 pt-8 text-center">
            <p class="text-xs text-gray-400">
                Generated via VetNotes Open Source • Local-First Clinical Intelligence
            </p>
            <p class="text-[10px] text-gray-300 mt-2">
                Timestamp: {new Date(patientContext.metadata.timestamp).toLocaleString()} • Version: {patientContext.metadata.version}
            </p>
        </div>
    </div>
  </div>
</div>
