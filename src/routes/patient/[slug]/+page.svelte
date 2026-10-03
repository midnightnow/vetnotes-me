<script lang="ts">
  import type { VetClinicalData } from '$lib/types/vet-format';
  import type { PageData } from './$types';
  import { onMount } from 'svelte';
  import { db } from '$lib/firebase';
  import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
  import ScribeWidget from '$lib/components/ScribeWidget.svelte';

  let { data }: { data: PageData } = $props();

  // Make patientContext a reactive state variable in Svelte 5.
  // Null when no clinical note exists yet (pending pre-visit state).
  let patientContext = $state<VetClinicalData | null>(data.patientContext);
  let pending = $state<boolean>(data.pending);
  let imagingJobs = $state<any[]>([]);
  let activeFinding = $state<string | null>(null);

  import XRayOverlay from '$lib/components/XRayOverlay.svelte';

  // Keep state in sync with SSR page data loads
  $effect(() => {
    patientContext = data.patientContext;
    pending = data.pending;
  });

  onMount(() => {
    const path = data.activePath;
    
    // Listen to imaging jobs
    const clinicId = data.clinicId || 'demo-sandbox';
    const jobsQuery = query(
      collection(db, 'clinics', clinicId, 'imaging_jobs'),
      where('patientId', '==', data.slug)
    );
    
    const unsubscribeJobs = onSnapshot(jobsQuery, (snapshot) => {
      imagingJobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }, (err) => {
      console.warn('[VetNotes] imaging_jobs listener stopped:', err?.code || err);
    });

    if (!path) {
      return () => { unsubscribeJobs(); };
    }

    const unsubscribe = onSnapshot(doc(db, path), (noteSnap) => {
      if (noteSnap.exists()) {
        const note = noteSnap.data() as Record<string, any>;

        const exams = note?.clinical?.exams;
        const flatContent = note?.content?.soap;
        const soapData = exams?.[0]?.soap || flatContent || {};

        const patients = note?.registry?.patients || [];
        const patient = patients[0] || {};

        const charges: string[] = [];
        const finances = note?.clinical?.finances;
        if (Array.isArray(finances?.lineItems)) {
          charges.push(...finances.lineItems.map((item: any) => item.description || item.code).filter(Boolean));
        } else if (Array.isArray(note?.billing?.lineItems)) {
          charges.push(...note.billing.lineItems.map((item: any) => item.description || item.code).filter(Boolean));
        }

        patientContext = {
          metadata: {
            version: note?.version || '0.46.0',
            timestamp: note?.metadata?.created_at
              ? new Date(note.metadata.created_at).getTime()
              : Date.now(),
            origin: note?.metadata?.source === 'phone' || note?.metadata?.source === 'ambient' ? 'Aiva' : 'VetNotes',
            clientApp: 'VetNotes Web',
          },
          patient: {
            id: patient.patientId || patient.id || data.slug,
            name: patient.name || 'Patient',
            species: (patient.species || 'Canine').charAt(0).toUpperCase() + (patient.species || 'Canine').slice(1),
            breed: patient.breed || 'Unknown',
          },
          soap: {
            subjective: soapData.subjective || '',
            objective: soapData.objective || '',
            assessment: soapData.assessment || '',
            plan: soapData.plan || '',
          },
          charges,
        };
        pending = false;
      }
    }, (err) => {
      // Unauthenticated / cross-tenant reads are denied by Firestore rules.
      // Don't let the listener throw uncaught — just remain in the pending
      // pre-visit state (the record simply isn't visible to this viewer).
      console.warn('[VetNotes] patient snapshot listener stopped:', err?.code || err);
    });

    return () => {
      unsubscribe();
      unsubscribeJobs();
    };
  });
</script>

<div class="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
    
    <!-- HEADER -->
    <div class="bg-blue-600 px-8 py-6 text-white text-center">
        <h1 class="text-3xl font-bold tracking-tight">VetNotes</h1>
        <p class="text-blue-100 mt-2">Clinical Consultation Record • Privacy-First</p>
    </div>

    <div class="p-8">
      {#if patientContext && !pending}
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
        {#if imagingJobs.length > 0}
        <div class="mt-12 border-t border-gray-100 pt-8">
            <h3 class="text-xs font-bold text-blue-600 uppercase tracking-widest mb-6 pb-2">Diagnostic Imaging</h3>
            <div class="grid grid-cols-1 gap-12">
              {#each imagingJobs as job}
                {#if job.image_url}
                  <div class="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-md">
                    <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                        <h4 class="text-sm font-bold text-gray-800 capitalize">{job.modality || 'Imaging'} Analysis</h4>
                        <span class="text-xs font-mono text-gray-400">Gemini 3.7 Flash</span>
                    </div>
                    
                    <div class="relative w-full bg-slate-900 flex justify-center">
                      <XRayOverlay 
                        imageUrl={job.image_url} 
                        areasOfInterest={job.findings?.areas_of_interest || []} 
                        activeFinding={activeFinding} 
                      />
                    </div>

                    <!-- Findings Text -->
                    {#if job.findings?.areas_of_interest && job.findings.areas_of_interest.length > 0}
                      <div class="p-6">
                        <h5 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Identified Areas of Interest</h5>
                        <ul class="space-y-2">
                          {#each job.findings.areas_of_interest as area}
                            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                            <li 
                              class="p-3 rounded-lg border transition-all cursor-default {activeFinding === area.finding ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}"
                              onmouseenter={() => activeFinding = area.finding}
                              onmouseleave={() => activeFinding = null}
                            >
                              <div class="flex items-center justify-between mb-1">
                                <span class="font-bold text-gray-800">{area.finding}</span>
                                {#if area.clinical_significance}
                                  <span class="text-[10px] px-2 py-0.5 rounded-full font-bold {area.clinical_significance === 'CRITICAL' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}">
                                    {area.clinical_significance}
                                  </span>
                                {/if}
                              </div>
                              {#if area.evidence_description}
                                <p class="text-sm text-gray-600">{area.evidence_description}</p>
                              {/if}
                            </li>
                          {/each}
                        </ul>
                      </div>
                    {:else if job.findings?.objective_findings}
                      <div class="p-6">
                        <h5 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Objective Findings</h5>
                        <ul class="list-disc pl-5 text-sm text-gray-700 space-y-2">
                          {#each job.findings.objective_findings as finding}
                            <li>{finding}</li>
                          {/each}
                        </ul>
                      </div>
                    {/if}
                  </div>
                {/if}
              {/each}
            </div>
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
      {:else}
        <!-- Pending pre-visit state: no clinical note exists for this slug yet.
             The live onSnapshot subscription above will replace this with the real
             record the moment the visit is scribed. -->
        <div class="py-16 text-center">
            <div class="mx-auto mb-6 h-12 w-12 rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin"></div>
            <h2 class="text-2xl font-bold text-gray-900 mb-2">No record to show yet</h2>
            <p class="text-gray-500 max-w-md mx-auto">
                There's no clinical record on this page yet. Once the visit has been
                written up it will appear here. If you're clinic staff, make sure
                you're signed in to your clinic to view it.
            </p>
            <p class="text-[10px] text-gray-300 mt-8 font-mono break-all">Ref: {data.slug}</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<ScribeWidget clinicId={data.clinicId || 'demo-clinic'} patientId={data.slug} />
