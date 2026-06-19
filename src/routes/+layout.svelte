<script lang="ts">
    import "../app.css";
    import GlobalNav from "$lib/components/GlobalNav.svelte";
    import SupportChat from "$lib/components/SupportChat.svelte";
    import { page } from "$app/stores";
    import { initAuth } from "$lib/stores/auth";
    import { initAuthListener } from "$lib/auth";
    import { onMount } from "svelte";

    onMount(() => {
        initAuth();
        
        // Start listening to Firebase auth changes for cookie sync
        const unsubscribe = initAuthListener();
        
        return () => {
            unsubscribe();
        };
    });
</script>

<div class="relative min-h-screen">
    {#if $page.url.pathname !== "/"}
        <GlobalNav />
    {/if}
    <main>
        <slot />
    </main>
    <SupportChat />
</div>
