<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { signUpWithEmail, signInWithGoogle } from '$lib/stores/auth';

  let name = $state('');
  let email = $state('');
  let password = $state('');
  let redirectTo = $state('/cpd');
  let isLoading = $state(false);
  let errorMsg = $state('');

  onMount(() => {
    const queryRedirect = $page.url.searchParams.get('redirectTo');
    if (queryRedirect) {
      redirectTo = decodeURIComponent(queryRedirect);
    }
  });

  function parseAuthError(err: any): string {
    const code = err?.code || '';
    if (code === 'auth/email-already-in-use') {
      return 'An account with this email already exists. Please sign in instead.';
    } else if (code === 'auth/invalid-email') {
      return 'Please enter a valid email address.';
    } else if (code === 'auth/weak-password') {
      return 'Password must be at least 6 characters long.';
    } else if (code === 'auth/popup-closed-by-user') {
      return 'Google sign-up was cancelled.';
    } else if (code === 'auth/popup-blocked') {
      return 'Pop-up window blocked by browser. Please allow popups or use email sign up.';
    }
    return err?.message || 'Failed to create account. Please try again.';
  }

  async function handleEmailSignUp(e: Event) {
    e.preventDefault();
    if (!email || !password) {
      errorMsg = 'Please provide an email and password.';
      return;
    }
    if (password.length < 6) {
      errorMsg = 'Password must be at least 6 characters.';
      return;
    }

    isLoading = true;
    errorMsg = '';

    try {
      await signUpWithEmail(email, password, name);
      await goto(redirectTo);
    } catch (err) {
      errorMsg = parseAuthError(err);
    } finally {
      isLoading = false;
    }
  }

  async function handleGoogleSignUp() {
    isLoading = true;
    errorMsg = '';
    try {
      await signInWithGoogle();
      await goto(redirectTo);
    } catch (err) {
      errorMsg = parseAuthError(err);
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>Create Account | VetNotes</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-slate-950 p-4 font-sans text-slate-100">
  <div class="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
    <div class="text-center mb-6">
      <div class="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/20">
        <span class="text-white text-xl font-bold">VN</span>
      </div>
      <h1 class="text-2xl font-bold text-white tracking-tight">Create your VetNotes account</h1>
      <p class="text-sm text-slate-400 mt-1">Get started with clinical scribe tools & CPD Academy</p>
    </div>

    {#if errorMsg}
      <div class="mb-4 p-3 bg-red-950/80 border border-red-800/60 text-red-200 text-xs rounded-xl flex items-center gap-2">
        <svg class="w-4 h-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>{errorMsg}</span>
      </div>
    {/if}

    <form onsubmit={handleEmailSignUp} class="space-y-4">
      <div>
        <label for="name" class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Full Name</label>
        <input
          id="name"
          type="text"
          bind:value={name}
          placeholder="Dr. Sarah Jenkins"
          class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      <div>
        <label for="email" class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Email Address *</label>
        <input
          id="email"
          type="email"
          required
          bind:value={email}
          placeholder="sarah@vetpractice.com"
          class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      <div>
        <label for="password" class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Password *</label>
        <input
          id="password"
          type="password"
          required
          minlength="6"
          bind:value={password}
          placeholder="At least 6 characters"
          class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        class="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-all disabled:opacity-50 shadow-md shadow-blue-600/20"
      >
        {#if isLoading}
          Creating account...
        {:else}
          Create Account
        {/if}
      </button>
    </form>

    <div class="relative my-6 text-center">
      <div class="absolute inset-0 flex items-center">
        <div class="w-full border-t border-slate-800"></div>
      </div>
      <span class="relative bg-slate-900 px-3 text-xs text-slate-500 uppercase font-medium">Or continue with</span>
    </div>

    <button
      type="button"
      onclick={handleGoogleSignUp}
      disabled={isLoading}
      class="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
    >
      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" class="w-4 h-4" />
      <span>Sign up with Google</span>
    </button>

    <p class="mt-6 text-center text-xs text-slate-400">
      Already have an account?
      <a href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`} class="text-blue-400 font-semibold hover:underline">
        Sign in
      </a>
    </p>
  </div>
</div>
