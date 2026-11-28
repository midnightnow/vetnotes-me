<script lang="ts">
  // Shared frame for /terms, /privacy and /refunds: a plain, light, readable
  // page with links between the three. The wording lives in each page.
  import type { Snippet } from 'svelte';

  let { title, children }: { title: string; children: Snippet } = $props();

  const pages = [
    { href: '/terms', label: 'Terms' },
    { href: '/refunds', label: 'Refund Policy' },
    { href: '/privacy', label: 'Privacy' },
    { href: '/pricing', label: 'Pricing' }
  ];
</script>

<div class="min-h-screen bg-slate-50 py-16 px-4">
  <article class="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8 md:p-10">
    <h1 class="text-3xl font-extrabold text-slate-900 mb-6">{title}</h1>
    <div class="prose prose-slate max-w-none">
      {@render children()}
    </div>
    <nav class="mt-10 pt-6 border-t border-slate-200 text-sm text-slate-500 flex flex-wrap gap-x-4 gap-y-2" aria-label="Legal pages">
      {#each pages as p}
        <a href={p.href} class="text-blue-600 hover:underline">{p.label}</a>
      {/each}
    </nav>
  </article>
</div>
