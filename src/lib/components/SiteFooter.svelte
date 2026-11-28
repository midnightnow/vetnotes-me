<script lang="ts">
  // Site-wide footer: who sells VetNotes, and the legal pages. Colours come
  // from the theme variables in app.css so it reads on daylight and nightshift.
  import { SELLER_ABN, SELLER_NAME } from '$lib/constants/legal';

  const year = new Date().getFullYear();

  const links = [
    { href: '/pricing', label: 'Pricing' },
    { href: '/terms', label: 'Terms' },
    { href: '/refunds', label: 'Refund Policy' },
    { href: '/privacy', label: 'Privacy' },
    { href: '/tickets', label: 'Support' }
  ];
</script>

<footer
  class="px-4 py-8 text-center text-xs"
  style="color: var(--t-muted, #5c6a62); border-top: 1px solid var(--t-border, #e3ded2);"
  data-testid="site-footer"
>
  <nav class="flex flex-wrap justify-center gap-x-5 gap-y-2 mb-3" aria-label="Footer">
    {#each links as link}
      <a href={link.href} class="underline-offset-2 hover:underline" style="color: var(--t-ink-2, #4f5d55);">
        {link.label}
      </a>
    {/each}
  </nav>
  <p>&copy; {year} {SELLER_NAME} · ABN {SELLER_ABN}</p>
</footer>
