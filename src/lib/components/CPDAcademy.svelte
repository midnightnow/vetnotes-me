<script lang="ts">
  import { onMount } from 'svelte';
  import type { CPDAttendance, CPDSession } from '$lib/types/cpd';
  import { db } from '$lib/firebase';
  import { user } from '$lib/stores/auth';
  import { collection, getDocs, query, where } from 'firebase/firestore';

  let attendance: CPDAttendance[] = $state([]);
  let sessions: CPDSession[] = $state([]);
  let loading = $state(true);

  async function loadCatalog(uid: string) {
    try {
      // Attendance MUST be scoped to the current user — an unscoped collection read
      // both leaks other practitioners' records and is denied by the read-own rule.
      const [attendanceSnap, sessionsSnap] = await Promise.all([
        getDocs(query(collection(db, 'cpd_attendance'), where('user_id', '==', uid))),
        // No orderBy: sessions don't carry created_at, and orderBy would silently
        // exclude every session that lacks the field (i.e. all of them). Sort client-side.
        getDocs(collection(db, 'cpd_sessions')),
      ]);

      attendance = attendanceSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as CPDAttendance[];
      sessions = (sessionsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as CPDSession[]).sort(
        (a, b) => (a.title || '').localeCompare(b.title || '')
      );
    } catch (err) {
      console.error('Failed to fetch CPD catalog', err);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    // Wait for Firebase client auth to resolve before reading (the read-own rules
    // need request.auth). The /cpd layout already gates access, so a user arrives.
    const unsub = user.subscribe((u) => {
      if (u && loading) loadCatalog(u.uid);
    });
    return unsub;
  });

  function getHours(session: CPDSession) {
    return session.duration_minutes ? `${(session.duration_minutes / 60).toFixed(1)} CPD HOUR` : 'CPD HOUR';
  }

  function isCompletedForSession(session: CPDSession) {
    return attendance.some((att) => {
      if (att.session_id !== session.id || !att.completed_at) return false;
      return session.case_ids.every((caseId) => att.completed_case_ids.includes(caseId));
    });
  }

  function getAttendanceForSession(session: CPDSession) {
    return attendance.find((att) => att.session_id === session.id);
  }

  function downloadCertificate(session: CPDSession) {
    const att = getAttendanceForSession(session);
    if (att?.id) {
      window.open(`/cpd/certificate/${att.id}`, '_blank');
    }
  }
</script>

<svelte:head>
  <title>VetNotes CPD Academy | Professional Development</title>
</svelte:head>

<div class="max-w-6xl mx-auto px-4 py-12">
  <header class="mb-12">
    <h1 class="text-4xl font-extrabold text-white mb-4">VetNotes <span class="text-blue-500">CPD Academy</span></h1>
    <p class="text-xl text-white/60">Case-based, self-directed CPD modules for modern practitioners.</p>
  </header>

  {#if loading}
    <p class="text-white/60">Loading modules...</p>
  {:else if sessions.length === 0}
    <div class="bg-white/[0.01] border border-white/5 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center">
      <div class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <span class="text-2xl">Modules</span>
      </div>
      <h3 class="text-lg font-bold text-white/40 mb-2">More Modules Coming Soon</h3>
      <p class="text-sm text-white/20">We are currently calibrating new cases in Cardiology, Ophthalmology, and Emergency Medicine.</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {#each sessions as session}
        {@const completed = isCompletedForSession(session)}
        <div class="group block bg-white/[0.03] border border-white/10 rounded-3xl overflow-hidden hover:border-blue-500/50 transition-all hover:shadow-2xl hover:shadow-blue-500/10">
          <div class="aspect-video bg-black relative overflow-hidden">
            {#if session.session_type === 'IMAGING'}
              <img
                src="https://storage.googleapis.com/vetsorcery/educational/case_rad_001/lat_view.jpg"
                alt={session.title}
                class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              />
            {:else}
              <div class="w-full h-full flex items-center justify-center text-white/40">CPD Module</div>
            {/if}
            <div class="absolute top-4 right-4">
              <span class="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold uppercase rounded-full shadow-lg">{session.session_type}</span>
            </div>
            {#if !session.is_free}
              <div class="absolute top-4 left-4">
                <span class="px-3 py-1 bg-amber-500 text-black text-[10px] font-bold uppercase rounded-full shadow-lg">Premium</span>
              </div>
            {/if}
          </div>
          <div class="p-6">
            <div class="flex items-center gap-2 mb-3">
              <span class="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Clinical/Scientific</span>
              <span class="text-white/20">•</span>
              <span class="text-[10px] font-bold text-white/40 uppercase tracking-widest">{getHours(session)}</span>
            </div>
            <h3 class="text-xl font-bold text-white group-hover:text-blue-400 transition-colors leading-tight mb-4">
              {session.title}
            </h3>
            {#if completed}
              <div class="flex items-center justify-between mt-auto">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span class="text-sm font-medium text-green-400">Completed</span>
                </div>
                <button
                  onclick={(e) => { e.preventDefault(); downloadCertificate(session); }}
                  class="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold text-white uppercase tracking-widest transition-all"
                >
                  Certificate
                </button>
              </div>
            {:else}
              <div class="flex items-center justify-between mt-auto">
                <span class="text-sm font-medium text-white/60">{session.is_free ? 'Start Module' : 'Locked'}</span>
                <span class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-600 transition-all">
                  <span class="text-white">{session.is_free ? 'Start' : 'Locked'}</span>
                </span>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  :global(body) {
    background-color: #020617;
  }
</style>
