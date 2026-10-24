<!-- src/lib/components/DicomViewer.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';

  export let imageUrl: string = '';
  export let annotations: any[] = [];
  export let studyId: string = '';
  export let instanceUrls: string[] = [];
  export let metadata: any = {};

  $: activeUrl = imageUrl || (instanceUrls && instanceUrls.length > 0 ? instanceUrls[0] : '');

  let ImagingViewer: any;
  let isMounted = false;

  onMount(async () => {
    try {
      // Dynamically load the browser-only package/component during client mount
      // @ts-ignore
      const module = await import('vetsorcery-imaging');
      ImagingViewer = module.default || module.Viewer;
      isMounted = true;
    } catch (err) {
      console.error('Failed to load vetsorcery-imaging engine:', err);
    }
  });
</script>

<div class="w-full h-full min-h-[450px] bg-zinc-950 rounded-lg overflow-hidden relative border border-zinc-850">
  {#if isMounted && ImagingViewer}
    <svelte:component
      this={ImagingViewer}
      src={activeUrl}
      {annotations}
      {studyId}
      {metadata}
    />
  {:else}
    <div class="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-2">
      <div class="w-6 h-6 border-2 border-t-blue-500 border-zinc-800 rounded-full animate-spin"></div>
      <span class="text-xs">Initializing Diagnostic Imaging Canvas...</span>
    </div>
  {/if}
</div>
