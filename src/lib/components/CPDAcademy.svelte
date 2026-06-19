<script lang="ts">
  import { onMount } from 'svelte';
  
  let attendance: any[] = $state([]);
  let loading = $state(true);

  const cases = [
    {
      id: 'case_rad_001_pnuemonia',
      title: 'Canine Pneumonia & Alveolar Patterns',
      difficulty: 'Intermediate',
      category: 'Clinical/Scientific',
      hours: 1.0,
      image: 'https://storage.googleapis.com/vetsorcery/educational/case_rad_001/lat_view.jpg',
      isFree: true
    },
    {
      id: 'case_rad_002_asthma',
      title: 'Feline Asthma and Pleural Effusion',
      difficulty: 'Advanced',
      category: 'Clinical/Scientific',
      hours: 1.0,
      image: 'https://storage.googleapis.com/vetsorcery/educational/case_rad_002/lat_view.jpg',
      isFree: false
    }
  ];

  onMount(async () => {
    try {
      const res = await fetch('/api/cpd/attendance');
      if (res.ok) {
        const data = await res.json();
        attendance = data.attendance;
      }
    } catch (err) {
      console.error('Failed to fetch attendance', err);
    } finally {
      loading = false;
    }
  });

  function getAttendanceForCase(caseId: string) {
    return attendance.find(a => a.completed_case_ids?.includes(caseId));
  }

  function downloadCertificate(attendanceId: string) {
    window.open(`/cpd/certificate/${attendanceId}`, '_blank');
  }
</script>

<svelte:head>
  <title>VetNotes CPD Academy | Professional Development</title>
</svelte:head>

<div class="max-w-6xl mx-auto px-4 py-12">
  <header class="mb-12">
    <h1 class="text-4xl font-extrabold text-white mb-4">VetNotes <span class="text-blue-500">CPD Academy</span></h1>
    <p class="text-xl text-white/60">Verifiable Clinical Competency Modules for Modern Practitioners.</p>
  </header>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
    {#each cases as c}
      {@const userAtt = getAttendanceForCase(c.id)}
      <a href="/cpd/cases/{c.id}" class="group block bg-white/[0.03] border border-white/10 rounded-3xl overflow-hidden hover:border-blue-500/50 transition-all hover:shadow-2xl hover:shadow-blue-500/10">
        <div class="aspect-video bg-black relative overflow-hidden">
          <img src={c.image} alt={c.title} class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
          <div class="absolute top-4 right-4">
            <span class="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold uppercase rounded-full shadow-lg">{c.difficulty}</span>
          </div>
          {#if !c.isFree}
            <div class="absolute top-4 left-4">
              <span class="px-3 py-1 bg-amber-500 text-black text-[10px] font-bold uppercase rounded-full shadow-lg">Premium</span>
            </div>
          {/if}
        </div>
        <div class="p-6">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{c.category}</span>
            <span class="text-white/20">•</span>
            <span class="text-[10px] font-bold text-white/40 uppercase tracking-widest">{c.hours} CPD HOUR</span>
          </div>
          <h3 class="text-xl font-bold text-white group-hover:text-blue-400 transition-colors leading-tight mb-4">
            {c.title}
          </h3>
          
          {#if userAtt?.completed_at}
            <div class="flex items-center justify-between mt-auto">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span class="text-sm font-medium text-green-400">Completed</span>
              </div>
              <button 
                onclick={(e) => { e.preventDefault(); downloadCertificate(userAtt.id); }}
                class="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold text-white uppercase tracking-widest transition-all"
              >
                Certificate
              </button>
            </div>
          {:else}
            <div class="flex items-center justify-between mt-auto">
              <span class="text-sm font-medium text-white/60">{c.isFree ? 'Start Module' : 'Locked'}</span>
              <span class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-600 transition-all">
                <span class="text-white">{c.isFree ? '→' : '🔒'}</span>
              </span>
            </div>
          {/if}
        </div>
      </a>
    {/each}

    <!-- Coming Soon Placeholder -->
    <div class="bg-white/[0.01] border border-white/5 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center">
      <div class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <span class="text-2xl">🧪</span>
      </div>
      <h3 class="text-lg font-bold text-white/40 mb-2">More Modules Coming Soon</h3>
      <p class="text-sm text-white/20">We are currently calibrating new cases in Cardiology, Ophthalmology, and Emergency Medicine.</p>
    </div>
  </div>
</div>

<style>
  :global(body) {
    background-color: #020617;
  }
</style>
