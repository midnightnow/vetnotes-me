<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/firebase';
  import { GoogleAuthProvider, signInWithPopup, getIdToken } from 'firebase/auth';

  let redirectTo = '/cpd';
  let isLoading = false;

  onMount(() => {
    const queryRedirect = $page.url.searchParams.get('redirectTo');
    if (queryRedirect) {
      redirectTo = decodeURIComponent(queryRedirect);
    }
  });

  async function syncSessionCookie(user: any) {
    const token = await getIdToken(user, true);
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
  }

  async function handleGoogleSignIn() {
    isLoading = true;
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await syncSessionCookie(result.user);
      await goto(redirectTo);
    } catch (error) {
      console.error("Sign-in failed", error);
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>Login | VetNotes</title>
</svelte:head>

<div class="login-page">
  <div class="login-card">
    <div class="logo">
      <div class="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
        <span class="text-white text-xl font-bold">VN</span>
      </div>
      <h2>Access VetNotes CPD Academy</h2>
      <p>To view clinical cases and log your verifiable hours, please sign in.</p>
    </div>

    <button class="google-btn" on:click={handleGoogleSignIn} disabled={isLoading}>
      {#if isLoading}
        Signing in...
      {:else}
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" />
        Sign In with Google
      {/if}
    </button>
  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--t-bg, #020617);
    padding: 1rem;
  }
  .login-card {
    background: var(--t-surface, #0f172a);
    border: 1px solid var(--t-border, rgba(255,255,255,0.1));
    padding: 2.5rem;
    border-radius: 2rem;
    max-width: 400px;
    width: 100%;
    text-align: center;
    box-shadow: var(--t-panel-shadow, 0 25px 50px -12px rgba(0, 0, 0, 0.5));
  }
  .logo h2 {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--t-ink, white);
    margin-bottom: 0.5rem;
  }
  .logo p {
    color: var(--t-muted, #94a3b8);
    font-size: 0.9rem;
    margin-bottom: 2rem;
    line-height: 1.5;
  }
  .google-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    background: white;
    color: #1e293b;
    padding: 0.75rem;
    border: 1px solid var(--t-border, transparent);
    border-radius: 0.75rem;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  .google-btn:hover {
    background: #f1f5f9;
    transform: translateY(-1px);
  }
  .google-btn img {
    width: 18px;
    height: 18px;
  }
</style>
