<script lang="ts">
    import "../app.css";
    import GlobalNav from "$lib/components/GlobalNav.svelte";
    import SupportChat from "$lib/components/SupportChat.svelte";
    import { page } from "$app/stores";
    import { afterNavigate } from "$app/navigation";
    import { initGoogleAnalytics, trackGaPageView } from "$lib/analytics/googleAnalytics";
    import { theme } from "$lib/stores/theme";
    import { initAuth } from "$lib/stores/auth";
    import { initAuthListener } from "$lib/auth";
    import { onMount } from "svelte";

    /* The site is client-routed, so a route change fires no browser navigation
       and GA would otherwise only ever see the first page of a session.
       Comparing pathnames (rather than counting callbacks) keeps this correct no
       matter how afterNavigate orders itself against onMount on the first load. */
    let lastPath = "";

    onMount(() => {
        lastPath = window.location.pathname;
        initGoogleAnalytics();

        initAuth();

        // Start listening to Firebase auth changes for cookie sync
        const unsubscribe = initAuthListener();
        
        return () => {
            unsubscribe();
        };
    });

    afterNavigate(({ to }) => {
        const path = to?.url.pathname;
        if (!path || path === lastPath) return;
        lastPath = path;
        trackGaPageView(path);
    });
</script>

<div class="relative min-h-screen {$theme === 'nightshift' ? 'nightshift' : 'daylight'}">
    {#if $page.url.pathname !== "/"}
        <GlobalNav />
    {/if}
    <main>
        <slot />
    </main>
    <SupportChat />
</div>
