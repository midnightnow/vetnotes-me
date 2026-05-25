<script lang="ts">
    import { user, loading, signInWithGoogle, signOut } from '$lib/stores/auth';

    let isSigningIn = false;
    let error = '';

    async function handleSignIn() {
        isSigningIn = true;
        error = '';
        try {
            await signInWithGoogle();
        } catch (e: any) {
            error = e.message || 'Sign-in failed';
        } finally {
            isSigningIn = false;
        }
    }

    async function handleSignOut() {
        await signOut();
    }
</script>

{#if $loading}
    <div class="w-8 h-8 rounded-full bg-white/5 animate-pulse"></div>
{:else if $user}
    <div class="flex items-center space-x-3">
        <div class="flex items-center space-x-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
            {#if $user.photoURL}
                <img
                    src={$user.photoURL}
                    alt={$user.displayName || 'User'}
                    class="w-6 h-6 rounded-full"
                    referrerpolicy="no-referrer"
                />
            {:else}
                <div class="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                    <span class="text-[10px] font-bold text-white">
                        {($user.displayName || $user.email || '?')[0].toUpperCase()}
                    </span>
                </div>
            {/if}
            <span class="text-xs text-white/60 hidden md:inline max-w-[120px] truncate">
                {$user.displayName || $user.email}
            </span>
        </div>
        <button
            on:click={handleSignOut}
            class="text-[10px] text-white/30 hover:text-white/60 transition-colors uppercase tracking-widest font-bold"
        >
            Sign Out
        </button>
    </div>
{:else}
    <button
        on:click={handleSignIn}
        disabled={isSigningIn}
        class="flex items-center space-x-2 bg-white text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-neutral-100 transition-all disabled:opacity-50 shadow-md"
    >
        <svg class="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span>{isSigningIn ? 'Signing in...' : 'Sign in with Google'}</span>
    </button>
    {#if error}
        <p class="text-[10px] text-red-400 mt-1">{error}</p>
    {/if}
{/if}
