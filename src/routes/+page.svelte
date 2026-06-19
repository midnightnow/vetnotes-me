<script lang="ts">
    import { onMount } from "svelte";
    import VetNotesEditor from "$lib/components/VetNotesEditor.svelte";
    import { initAuth } from "$lib/stores/auth";

    onMount(() => {
        initAuth();
    });
</script>

<VetNotesEditor />
