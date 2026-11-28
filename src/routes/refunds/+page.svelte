<script lang="ts">
  /* ═══════════════════════════════════════════════════════════════════════
   * DRAFT — NOT REVIEWED. DO NOT DEPLOY UNTIL THE OWNER AND A LAWYER HAVE
   * READ AND APPROVED THIS TEXT.
   *
   * Drafted on 2026-11-27 from facts in this repository and facts the owner
   * supplied. No lawyer has written or read it. Buyers agree to this page
   * together with /terms, so a change of wording here also needs a new
   * TERMS_VERSION in `$lib/constants/legal.ts`.
   *
   * Facts used, and where each comes from:
   *   - Seller: AIVA Pty Ltd, ABN 85 693 383 292 (owner).
   *   - A$49 per month, billed monthly in advance by Stripe, renews until
   *     cancelled (owner).
   *   - Cancel any time from Manage subscription; access runs to the end of
   *     the paid period (owner; needs the Stripe Customer Portal set to
   *     cancel at the end of the billing period — DEPLOYMENT.md).
   *   - A payment refunded in full ends Pro on that account
   *     (`src/lib/server/stripe_webhook.ts`: `charge.refunded` with
   *     `refunded: true` revokes; a partial refund does not).
   *   - Australian Consumer Law rights are not excluded (owner).
   *
   * Undecided — the page is worded so it stays true without these:
   *   TODO(owner): the refund policy itself — whether there is a refund
   *     window, a guarantee, or pro-rata refunds on cancelling. NONE is
   *     stated or implied here; the page only says how to ask.
   *   TODO(owner): whether the A$49 price includes GST. The page does not say.
   *   TODO(owner): how quickly refund requests are answered. No time is promised.
   *   TODO(owner): confirm support@vetsorcery.com is a monitored mailbox.
   * ═══════════════════════════════════════════════════════════════════════ */
  import LegalPage from '$lib/components/LegalPage.svelte';
  import { SELLER_ABN, SELLER_NAME, SUPPORT_EMAIL, TERMS_VERSION } from '$lib/constants/legal';
</script>

<svelte:head>
  <title>Refund Policy | VetNotes</title>
  <meta name="description" content="How cancelling and refunds work for VetNotes Pro." />
</svelte:head>

<LegalPage title="Refund Policy">
  <p class="text-sm text-slate-500">Version: {TERMS_VERSION}</p>

  <p>
    This page is about VetNotes Pro, sold on vetnotes.me by {SELLER_NAME}, ABN {SELLER_ABN}.
  </p>

  <h2>How you are billed</h2>
  <p>
    VetNotes Pro costs A$49 per month. Stripe takes payment monthly in advance, and the
    subscription renews each month until you cancel it.
  </p>

  <h2>Cancelling</h2>
  <p>
    You can cancel at any time with <strong>Manage subscription</strong> on the
    <a href="/pricing">Pricing</a> page. When you cancel, Pro stays active until the end of the
    period you have already paid for, and you are not charged again.
  </p>

  <h2>Asking for a refund</h2>
  <p>
    If you think you have been charged by mistake, or you want to ask for a refund, email
    <a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a> or
    <a href="/tickets">open a support ticket</a>. Tell us the email address you sign in with so we
    can find the payment.
  </p>
  <p>If a payment is refunded in full, Pro on that account ends.</p>

  <h2>Your consumer rights</h2>
  <p>
    Nothing in this policy excludes, restricts or modifies any right or remedy you have under the
    Australian Consumer Law.
  </p>
</LegalPage>
