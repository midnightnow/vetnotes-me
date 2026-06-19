<script lang="ts">
  import { onMount } from 'svelte';
  import dayjs from 'dayjs';

  let { data } = $props();

  onMount(() => {
    // Optional: Auto-trigger print dialog if needed
    // window.print();
  });
</script>

<svelte:head>
  <title>CPD Certificate - {data.session.title}</title>
</svelte:head>

<div class="min-h-screen bg-white text-gray-900 p-8 flex items-center justify-center font-serif">
  <div class="max-w-4xl w-full border-[12px] border-double border-blue-900 p-12 relative overflow-hidden">
    <!-- Watermark Pattern (Decorative) -->
    <div class="absolute inset-0 opacity-[0.03] pointer-events-none select-none flex items-center justify-center rotate-[-30deg] scale-150">
      <div class="text-[120px] font-black uppercase">VetNotes Academy</div>
    </div>

    <!-- Header -->
    <div class="text-center mb-16 relative">
      <div class="text-blue-900 text-6xl font-black mb-2 tracking-tighter italic">VetNotes</div>
      <div class="text-sm uppercase tracking-[0.4em] font-bold text-gray-500">Clinical Excellence & Professional Development</div>
    </div>

    <!-- Content -->
    <div class="text-center space-y-8 relative">
      <h1 class="text-3xl font-bold uppercase tracking-widest text-gray-800">Certificate of Completion</h1>
      
      <div class="space-y-2">
        <p class="text-lg italic text-gray-600">This is to certify that</p>
        <p class="text-4xl font-extrabold border-b-2 border-gray-200 inline-block px-12 pb-1 text-gray-900">
          {data.user.displayName}
        </p>
      </div>

      <div class="space-y-4 max-w-2xl mx-auto">
        <p class="text-lg text-gray-700">
          has successfully completed the continuing professional development module:
        </p>
        <p class="text-2xl font-bold text-blue-900 leading-tight">
          {data.session.title}
        </p>
      </div>

      <div class="grid grid-cols-2 gap-12 pt-12 text-left max-w-2xl mx-auto">
        <div class="space-y-1">
          <p class="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Accreditation Time</p>
          <p class="text-xl font-bold text-gray-800">{(data.session.duration_minutes / 60).toFixed(1)} CPD Hours</p>
        </div>
        <div class="space-y-1">
          <p class="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Date of Completion</p>
          <p class="text-xl font-bold text-gray-800">{dayjs(data.attendance.completed_at).format('DD MMMM YYYY')}</p>
        </div>
      </div>
    </div>

    <!-- Signatures -->
    <div class="mt-20 flex justify-between items-end border-t border-gray-100 pt-12 relative">
      <div class="text-center">
        <div class="font-serif italic text-2xl mb-1 text-blue-900 opacity-80">A. Clinical-Director</div>
        <div class="w-48 h-px bg-gray-300 mx-auto mb-2"></div>
        <p class="text-[9px] uppercase font-bold text-gray-500 tracking-widest">Clinical Director, VetNotes Academy</p>
      </div>

      <div class="text-right space-y-1">
        <p class="text-[8px] uppercase font-bold text-gray-400">Verification ID</p>
        <p class="text-[10px] font-mono text-gray-600">{data.attendance.id}</p>
        <div class="text-[8px] text-gray-400 mt-2">Verified at vetnotes.me/verify</div>
      </div>
    </div>

    <!-- Official Seal -->
    <div class="absolute bottom-12 right-12 opacity-10">
      <div class="w-32 h-32 rounded-full border-4 border-blue-900 flex items-center justify-center text-center p-4">
        <span class="text-[10px] font-bold text-blue-900 uppercase">Official Accreditation Seal 2026</span>
      </div>
    </div>
  </div>
</div>

<style>
  @media print {
    :global(body) {
      background: white;
    }
    .min-h-screen {
      padding: 0;
    }
  }
</style>
