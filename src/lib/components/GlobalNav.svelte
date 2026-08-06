<script lang="ts">
    import { page } from "$app/stores";
    import { player } from "$lib/stores/player";
    import AuthButton from "$lib/components/AuthButton.svelte";

    export let breadcrumbs: { label: string; href: string }[] = [];

    $: currentPath = $page.url.pathname;

    const navLinks = [
        { label: "Consultation", href: "/", icon: "🩺" },
        { label: "Patients", href: "/patient", icon: "🐾" },
        { label: "CPD Academy", href: "/cpd", icon: "🎓" },
        { label: "Pricing", href: "/pricing", icon: "💳" },
        { label: "Tickets", href: "/tickets", icon: "🎫" },
        {
            label: "AIVA",
            href: "https://aiva.help",
            icon: "✨",
            external: true,
        },
    ];

    function setLens(lens: "standard" | "compact") {
        player.setLens(lens);
    }
</script>

<nav
    class="glass-panel sticky top-4 z-50 mx-4 mt-4 px-6 py-3 rounded-2xl flex items-center justify-between"
>
    <!-- Left: Branding & Breadcrumbs -->
    <div class="flex items-center space-x-6">
        <a href="/" class="flex items-center space-x-2">
            <div
                class="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20"
            >
                <span class="text-white text-xs font-bold">VN</span>
            </div>
            <span class="text-lg font-bold tracking-tight hidden md:block">
                VetNotes<span class="text-blue-400">.me</span>
            </span>
        </a>

        <div class="h-6 w-px bg-white/10 hidden md:block"></div>

        <!-- Breadcrumbs -->
        <div
            class="hidden lg:flex items-center space-x-2 text-sm text-white/40"
        >
            <a href="/" class="hover:text-white transition-colors">Home</a>
            {#each breadcrumbs as crumb}
                <span>/</span>
                <a
                    href={crumb.href}
                    class="hover:text-white transition-colors capitalize"
                >{crumb.label}</a>
            {/each}
        </div>
    </div>

    <!-- Center: Main Navigation -->
    <div
        class="hidden md:flex items-center space-x-1 bg-white/[0.03] p-1 rounded-xl border border-white/5"
    >
        {#each navLinks as link}
            {#if link.external}
                <a
                    href={link.href}
                    target="_blank"
                    class="px-4 py-1.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all flex items-center space-x-2"
                >
                    <span>{link.icon}</span>
                    <span class="hidden lg:inline">{link.label}</span>
                </a>
            {:else}
                <a
                    href={link.href}
                    class="px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center space-x-2
                        {currentPath === link.href
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'text-white/60 hover:text-white hover:bg-white/5'}"
                >
                    <span>{link.icon}</span>
                    <span class="hidden lg:inline">{link.label}</span>
                </a>
            {/if}
        {/each}
    </div>

    <!-- Right: Auth + Lens Switcher -->
    <div class="flex items-center space-x-4">
        <div
            class="flex items-center bg-black/30 p-1 rounded-xl border border-white/5"
        >
            <button
                on:click={() => setLens("standard")}
                class="px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all
                    {$player.preferredLens === 'standard'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                        : 'text-white/40 hover:text-white'}"
            >
                Standard
            </button>
            <button
                on:click={() => setLens("compact")}
                class="px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all
                    {$player.preferredLens === 'compact'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                        : 'text-white/40 hover:text-white'}"
            >
                Compact
            </button>
        </div>
        <AuthButton />
    </div>
</nav>

<style>
    .glass-panel {
        background: rgba(255, 255, 255, 0.02);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.05);
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
    }
</style>
