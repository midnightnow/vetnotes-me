<script lang="ts">
    import { patients, patientsLoading, selectedPatient, searchPatients, type Patient } from '$lib/stores/patients';
    import { isAuthenticated } from '$lib/stores/auth';
    import { clinicId } from '$lib/stores/clinic';

    let searchTerm = '';
    let isOpen = false;
    let filteredPatients: Patient[] = [];

    $: if (searchTerm) {
        filteredPatients = searchPatients(searchTerm);
    } else {
        filteredPatients = $patients;
    }

    function selectPatient(patient: Patient) {
        selectedPatient.set(patient);
        isOpen = false;
        searchTerm = '';
    }

    function clearSelection() {
        selectedPatient.set(null);
    }
</script>

{#if $isAuthenticated && $clinicId}
    <div class="relative">
        {#if $selectedPatient}
            <!-- Selected patient display -->
            <div class="flex items-center justify-between bg-blue-600/10 border border-blue-500/20 rounded-xl px-3 py-2">
                <div class="flex items-center space-x-2">
                    <span class="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Patient:</span>
                    <span class="text-xs text-white font-semibold">{$selectedPatient.name}</span>
                    <span class="text-[10px] text-white/40">({$selectedPatient.species}{$selectedPatient.breed ? ` · ${$selectedPatient.breed}` : ''})</span>
                    {#if $selectedPatient.ownerName}
                        <span class="text-[10px] text-white/30">| {$selectedPatient.ownerName}</span>
                    {/if}
                </div>
                <button on:click={clearSelection} class="text-white/30 hover:text-white text-xs">✕</button>
            </div>
        {:else}
            <!-- Patient picker trigger -->
            <button
                on:click={() => isOpen = !isOpen}
                class="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2 hover:bg-white/10 transition-colors"
            >
                <span class="text-[10px] uppercase tracking-widest text-white/40 font-bold">
                    {$patientsLoading ? 'Loading patients...' : 'Select Patient (optional)'}
                </span>
                <svg class="w-3 h-3 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
            </button>
        {/if}

        <!-- Dropdown -->
        {#if isOpen}
            <div class="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-40 max-h-[250px] overflow-hidden flex flex-col">
                <!-- Search -->
                <div class="p-2 border-b border-white/5">
                    <input
                        type="text"
                        bind:value={searchTerm}
                        placeholder="Search by name, owner, or species..."
                        class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-blue-500"
                    />
                </div>

                <!-- Patient list -->
                <div class="overflow-y-auto flex-1">
                    {#if filteredPatients.length === 0}
                        <div class="p-3 text-center text-xs text-white/30">
                            {$patientsLoading ? 'Loading...' : 'No patients found'}
                        </div>
                    {:else}
                        {#each filteredPatients.slice(0, 20) as patient}
                            <button
                                on:click={() => selectPatient(patient)}
                                class="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                            >
                                <div class="flex items-center justify-between">
                                    <div>
                                        <span class="text-xs font-semibold text-white">{patient.name}</span>
                                        <span class="text-[10px] text-white/40 ml-2">{patient.species}{patient.breed ? ` · ${patient.breed}` : ''}</span>
                                    </div>
                                    {#if patient.ownerName}
                                        <span class="text-[10px] text-white/30">{patient.ownerName}</span>
                                    {/if}
                                </div>
                            </button>
                        {/each}
                    {/if}
                </div>

                <!-- Close -->
                <button on:click={() => isOpen = false} class="p-2 text-center text-[10px] text-white/30 hover:text-white border-t border-white/5">
                    Close
                </button>
            </div>
        {/if}
    </div>
{/if}
