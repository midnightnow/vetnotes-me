<script lang="ts">
  // Honest pricing: only what exists today. The scribe editor is genuinely
  // free during beta. CPD Academy is UNLISTED (2026-08-02) — a review found
  // the credential unsound, so we advertise neither cases nor certification
  // until it is rebuilt; documentation takes that slot instead.
  // Practice-management plans live (and are purchasable) on vetsorcery.com —
  // we link rather than mirror prices, so the two sites can't drift apart.
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
      name: 'Documentation',
      price: 'Free',
      period: 'always',
      tagline: 'How to actually use each app, start to finish.',
      features: [
        'Quick start for every app — running in minutes',
        'Extended walkthroughs of each workflow',
        'What each product does and does not do',
        'No sign-in required'
      ],
      cta: { label: 'Read the docs', href: '/docs' },
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
    content="VetNotes is free during beta. Documentation is free and open. Practice-management plans are on vetsorcery.com."
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

    <div class="grid md:grid-cols-3 gap-6">
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
