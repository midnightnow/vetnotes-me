<script lang="ts">
  // "Manage subscription": opens the Stripe Billing Portal for the signed-in
  // vet, where they can cancel, change card or download invoices. Show it only
  // to vets whose /api/pro/status says `manageable`. The server works out whose
  // portal to open from the verified sign-in; nothing is sent from here.
  import { requestBillingPortal } from '$lib/billing/proClient';

  let { class: extraClass = '' }: { class?: string } = $props();

  let busy = $state(false);
  let problem = $state('');

  async function open() {
    busy = true;
    problem = '';
    const result = await requestBillingPortal();
    if (result.ok) {
      window.location.href = result.url;
      return;
    }
    if (result.reason === 'signed_out') {
      window.location.href = '/login?redirectTo=%2Fpricing';
      return;
    }
    problem = result.message;
    busy = false;
  }
</script>

<button
  type="button"
  onclick={open}
  disabled={busy}
  data-testid="manage-subscription"
  class="block w-full text-center px-4 py-2.5 rounded-xl font-semibold transition-colors bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed {extraClass}"
>
  {busy ? 'Opening…' : 'Manage subscription'}
</button>
{#if problem}
  <p class="text-sm text-red-600 text-center" role="alert">{problem}</p>
{/if}
