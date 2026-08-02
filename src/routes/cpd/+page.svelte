<script lang="ts">
  import CPDAcademy from '$lib/components/CPDAcademy.svelte';

  let { data } = $props();
</script>

<CPDAcademy sessions={data.sessions ?? []} />
