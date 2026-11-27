<script lang="ts">
  // Honest pricing: only what exists today. The scribe editor and CPD case
  // library are genuinely free; CPD certification checkout is intentionally
  // disabled until Stripe env is configured (api/cpd/checkout → 503), so we
  // say "launching soon" rather than print a price that can't be bought.
  // Practice-management plans live (and are purchasable) on vetsorcery.com —
  // we link rather than mirror prices, so the two sites can't drift apart.
  //
  // VetNotes Pro (A$49/mo) is the one tier here with a real Stripe price behind
  // it (`VETNOTES_PRO_PRICE_ID`). Its button posts to /api/pro/checkout, which
  // 503s with { configured: false } if the env is missing — in that case we show
  // the pre-sale state rather than a dead button, so this page can never
  // advertise a price that cannot actually be paid.
  //
  // What this page shows for Pro is decided by `proPageView` from what the
  // SERVER reports about the signed-in vet — never from `?pro_paid=1` alone,
  // which anyone can type. See `$lib/billing/proPageState.ts`.
  import { onMount } from 'svelte';
  import ManageSubscriptionButton from '$lib/components/ManageSubscriptionButton.svelte';
  import { fetchProStatus, type ProStatus } from '$lib/billing/proClient';
  import {
    accountFromStatus,
    proPageView,
    RECHECK_INTERVAL_MS,
    RECHECK_MAX_ATTEMPTS
  } from '$lib/billing/proPageState';

  let proBusy = $state(false);
  let proError = $state('');

  // `undefined` until the server answers; `null` if it could not be reached.
  let proStatus = $state<ProStatus | null | undefined>(undefined);
  let paidFlag = $state(false);
  let cancelledFlag = $state(false);
  let recheckAttempts = $state(0);
  let recheckTimer: ReturnType<typeof setTimeout> | undefined;

  const proView = $derived(
    proPageView({
      paidFlag,
      cancelledFlag,
      account: accountFromStatus(proStatus),
      manageable: proStatus?.manageable === true,
      recheckExhausted: recheckAttempts >= RECHECK_MAX_ATTEMPTS
    })
  );

  // Ask the server; while a payment is still being confirmed, ask again shortly.
  async function refreshProStatus() {
    clearTimeout(recheckTimer);
    proStatus = await fetchProStatus();
    if (proView.shouldRecheck) {
      recheckTimer = setTimeout(() => {
        recheckAttempts += 1;
        refreshProStatus();
      }, RECHECK_INTERVAL_MS);
    }
  }

  function checkAgain() {
    recheckAttempts = 0;
    refreshProStatus();
  }

  onMount(() => {
    const query = new URLSearchParams(window.location.search);
    paidFlag = query.get('pro_paid') === '1';
    cancelledFlag = query.get('pro_cancelled') === '1';
    refreshProStatus();
    return () => clearTimeout(recheckTimer);
  });

  async function startProCheckout() {
    proBusy = true;
    proError = '';
    try {
      const res = await fetch('/api/pro/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ return_path: '/pricing' })
      });

      if (res.status === 401) {
        window.location.href = '/login?redirectTo=%2Fpricing';
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      proError =
        data?.configured === false
          ? 'Pro checkout is not available just yet — please try again shortly.'
          : 'Could not start checkout. Please try again.';
    } catch {
      proError = 'Could not reach checkout. Please check your connection and try again.';
    } finally {
      proBusy = false;
    }
  }

  const tiers = [
    {
      name: 'VetNotes Scribe',
      price: 'Free',
      period: 'during beta',
      tagline: 'The consultation editor. No keyboards in the exam room.',
      features: [
        'AI-assisted SOAP note editor',
        'Voice-first consultation capture',
        'Patient record pages',
        'No payment details required'
      ],
      cta: { label: 'Open the editor', href: '/' },
      secondary: { label: 'Sign in with Google', href: '/login?redirectTo=%2F' },
      highlight: false
    },
    {
      name: 'CPD Academy',
      price: 'Free cases',
      period: 'certification launching soon',
      tagline: 'Interactive clinical cases with a verifiable CPD trail.',
      features: [
        'Completable clinical cases (cardiology, dermatology, surgery)',
        'Verifiable CPD hour logging',
        'Case-by-case scoring and feedback',
        'Paid certification (CPD Pass) launching soon'
      ],
      cta: { label: 'Browse CPD cases', href: '/cpd' },
      secondary: null,
      highlight: false
    },
    {
      name: 'VetNotes Basic',
      price: 'A$10',
      period: 'per month · 30-day free trial',
      tagline: 'For the solo vet who lives in the editor.',
      features: [
        'Everything in VetNotes Scribe',
        'Cloud SOAP structuring from voice',
        'Extended template library'
      ],
      // Stripe Payment Link (plink_1U36YzQtktamRZKgnIiZQygK, 2026-08-11).
      // stripeWebhook maps its 1000c recurring price → plan 'vetnotes_basic'.
      cta: {
        label: 'Start free trial',
        href: 'https://buy.stripe.com/bJecN7cg62wB3VJ8P0eUU0E',
        external: true
      },
      secondary: null,
      highlight: false
    },
    {
      name: 'VetNotes Pro',
      price: 'A$49',
      period: 'per month',
      tagline: 'The full clinical AI suite for a single vet.',
      features: [
        'Everything in VetNotes Scribe',
        'Cloud SOAP structuring from voice',
        'Premium charge detection on every consult',
        'Advanced clinical templates',
        'Sync notes to your practice system'
      ],
      cta: { label: 'Subscribe', action: 'pro' },
      secondary: null,
      highlight: true
    },
    {
      name: 'VetSorcery Practice OS',
      price: 'Paid plans',
      period: 'on vetsorcery.com',
      tagline: 'The full practice-management system for clinics.',
      features: [
        'Appointments, boards and patient records',
        'Billing staged straight from the clinical plan',
        'Dental charting and S8 controlled-drug register',
        'VetNotes included in practice workflows'
      ],
      cta: { label: 'See practice plans', href: 'https://vetsorcery.com/plans', external: true },
      secondary: { label: 'Try the live demo', href: 'https://vetsorcery.com/demo', external: true },
      highlight: false
    }
  ];
</script>

<svelte:head>
  <title>Pricing | VetNotes</title>
  <meta
    name="description"
    content="VetNotes is free during beta. CPD Academy cases are free with paid certification launching soon. Practice-management plans are on vetsorcery.com."
  />
</svelte:head>

<div class="min-h-screen bg-slate-50 py-16 px-4">
  <div class="max-w-6xl mx-auto">
    <div class="text-center mb-12">
      <h1 class="text-4xl font-extrabold text-slate-900 mb-3">Simple, honest pricing</h1>
      <p class="text-lg text-slate-600 max-w-2xl mx-auto">
        VetNotes is free while in beta. Pay only for what's actually available to buy —
        nothing here is a placeholder.
      </p>
    </div>

    {#if proView.notice === 'active'}
      <div
        class="max-w-2xl mx-auto mb-8 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-emerald-900"
        role="status"
        data-testid="pro-notice-active"
      >
        <p class="font-semibold">Payment received. Pro is active on this account.</p>
        <p class="text-sm mt-1">
          You can change your card, get invoices or cancel at any time with Manage subscription.
        </p>
      </div>
    {:else if proView.notice === 'checking'}
      <div
        class="max-w-2xl mx-auto mb-8 rounded-xl border border-slate-300 bg-white px-5 py-4 text-slate-700"
        role="status"
      >
        Checking your account…
      </div>
    {:else if proView.notice === 'confirming'}
      <div
        class="max-w-2xl mx-auto mb-8 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-900"
        role="status"
        data-testid="pro-notice-confirming"
      >
        <p class="font-semibold">We're confirming your payment.</p>
        <p class="text-sm mt-1">
          Pro is not active on this account yet. This page checks again every few seconds. Please
          do not pay a second time.
        </p>
      </div>
    {:else if proView.notice === 'unconfirmed'}
      <div
        class="max-w-2xl mx-auto mb-8 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-900"
        role="status"
        data-testid="pro-notice-unconfirmed"
      >
        <p class="font-semibold">We have not been able to confirm a payment for this account.</p>
        <p class="text-sm mt-1">
          Pro is not active on this account. If your card was charged, please do not pay again:
          <a href="/tickets" class="underline">open a support ticket</a> so we can check it.
        </p>
        <button
          type="button"
          onclick={checkAgain}
          class="mt-3 px-3 py-1.5 rounded-lg text-sm font-semibold border border-amber-400 hover:bg-amber-100"
        >
          Check again
        </button>
      </div>
    {:else if proView.notice === 'sign_in_to_confirm'}
      <div
        class="max-w-2xl mx-auto mb-8 rounded-xl border border-slate-300 bg-white px-5 py-4 text-slate-700"
        role="status"
      >
        <a href="/login?redirectTo=%2Fpricing%3Fpro_paid%3D1" class="text-blue-600 font-semibold hover:underline">Sign in</a>
        to see whether Pro is active on your account.
      </div>
    {:else if proView.notice === 'cancelled'}
      <div
        class="max-w-2xl mx-auto mb-8 rounded-xl border border-slate-300 bg-white px-5 py-4 text-slate-700"
        role="status"
      >
        Checkout was not completed, so Pro was not started on this account.
      </div>
    {/if}

    <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      {#each tiers as tier}
        <div
          class="bg-white rounded-2xl border p-8 flex flex-col {tier.highlight
            ? 'border-blue-500 shadow-lg shadow-blue-100 ring-1 ring-blue-500'
            : 'border-slate-200 shadow-sm'}"
        >
          <h2 class="text-xl font-bold text-slate-900">{tier.name}</h2>
          <p class="text-sm text-slate-500 mt-1 min-h-[2.5rem]">{tier.tagline}</p>

          <div class="my-6">
            <span class="text-3xl font-extrabold text-slate-900">{tier.price}</span>
            <span class="text-sm text-slate-500 ml-2">{tier.period}</span>
          </div>

          <ul class="space-y-3 mb-8 flex-1">
            {#each tier.features as feature}
              <li class="flex items-start gap-2 text-sm text-slate-700">
                <span class="text-blue-600 mt-0.5">✓</span>
                <span>{feature}</span>
              </li>
            {/each}
          </ul>

          <div class="space-y-2">
            {#if tier.cta.action === 'pro'}
              {#if proView.cta === 'manage'}
                <p class="text-sm font-medium text-emerald-700 text-center" data-testid="pro-active">
                  ✓ Pro is active on this account.
                </p>
                <ManageSubscriptionButton />
              {:else if proView.cta === 'included'}
                <p class="text-sm text-slate-600 text-center" data-testid="pro-included">
                  Pro features are already active on this account through your current plan. There is
                  nothing to buy here.
                </p>
              {:else if proView.cta === 'checking'}
                <button
                  type="button"
                  disabled
                  class="block w-full text-center px-4 py-2.5 rounded-xl font-semibold bg-blue-600 text-white opacity-60 cursor-not-allowed"
                >
                  {proView.notice === 'confirming' ? 'Confirming your payment…' : 'Checking your account…'}
                </button>
              {:else}
                <button
                  type="button"
                  onclick={startProCheckout}
                  disabled={proBusy}
                  data-testid="pro-subscribe"
                  class="block w-full text-center px-4 py-2.5 rounded-xl font-semibold transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {proBusy ? 'Starting checkout…' : tier.cta.label}
                </button>
                {#if proError}
                  <p class="text-sm text-red-600 text-center" role="alert">{proError}</p>
                {/if}
              {/if}
            {:else}
            <a
              href={tier.cta.href}
              target={tier.cta.external ? '_blank' : undefined}
              rel={tier.cta.external ? 'noopener noreferrer' : undefined}
              class="block w-full text-center px-4 py-2.5 rounded-xl font-semibold transition-colors {tier.highlight
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-900 text-white hover:bg-slate-700'}"
            >
              {tier.cta.label}
            </a>
            {#if tier.secondary}
              <a
                href={tier.secondary.href}
                target={tier.secondary.external ? '_blank' : undefined}
                rel={tier.secondary.external ? 'noopener noreferrer' : undefined}
                class="block w-full text-center px-4 py-2.5 rounded-xl font-medium text-slate-700 border border-slate-300 hover:bg-slate-100 transition-colors"
              >
                {tier.secondary.label}
              </a>
            {/if}
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <p class="text-center text-sm text-slate-400 mt-10">
      Questions? <a href="/tickets" class="text-blue-600 hover:underline">Open a support ticket</a>
      — a real person reads every one.
    </p>
  </div>
</div>
