<script lang="ts">
  /* ═══════════════════════════════════════════════════════════════════════
   * DRAFT — NOT REVIEWED. DO NOT DEPLOY UNTIL THE OWNER AND A LAWYER HAVE
   * READ AND APPROVED THIS TEXT.
   *
   * These terms were drafted on 2026-11-27 from facts in this repository and
   * facts the owner supplied. No lawyer has written or read them. When the
   * reviewed wording replaces this, change TERMS_VERSION in
   * `$lib/constants/legal.ts` (buyers' agreement is recorded against it) and
   * remove this note.
   *
   * Facts used, and where each comes from:
   *   - Seller: AIVA Pty Ltd, ABN 85 693 383 292 (owner).
   *   - VetNotes Pro is A$49 per month, billed monthly in advance by Stripe,
   *     and renews until cancelled (owner; price also on /pricing).
   *   - Cancel any time from Manage subscription; access runs to the end of
   *     the paid period (owner). This is only true if the Stripe Customer
   *     Portal is set to cancel at the end of the billing period — see
   *     DEPLOYMENT.md.
   *   - Australian Consumer Law rights are not excluded (owner).
   *   - VetNotes drafts notes for the vet to review (README.md).
   *
   * Undecided — the page is worded so it stays true without these:
   *   TODO(owner): whether the A$49 price includes GST. The page does not say.
   *   TODO(lawyer): liability, warranties and clinical-responsibility wording.
   *   TODO(lawyer): governing law and jurisdiction.
   *   TODO(owner): how and with what notice the price or these terms may change.
   *   TODO(owner): when we may suspend or end a subscription.
   *   TODO(owner): terms for VetNotes Basic (sold by Stripe Payment Link, with
   *     no agreement step) and for the free tier. This page covers Pro only.
   *   TODO(owner): confirm support@vetsorcery.com is a monitored mailbox.
   * ═══════════════════════════════════════════════════════════════════════ */
  import LegalPage from '$lib/components/LegalPage.svelte';
  import { SELLER_ABN, SELLER_NAME, SUPPORT_EMAIL, TERMS_VERSION } from '$lib/constants/legal';
</script>

<svelte:head>
  <title>Terms | VetNotes</title>
  <meta name="description" content="Terms for a VetNotes Pro subscription." />
</svelte:head>

<LegalPage title="VetNotes Pro Terms">
  <p class="text-sm text-slate-500">Version: {TERMS_VERSION}</p>

  <h2>Who you are dealing with</h2>
  <p>
    VetNotes (vetnotes.me) is provided by {SELLER_NAME}, ABN {SELLER_ABN}. In these terms, "we" and
    "us" mean {SELLER_NAME}.
  </p>

  <h2>What these terms cover</h2>
  <p>
    These terms apply to a VetNotes Pro subscription bought on vetnotes.me. You agree to them when
    you tick the box on the <a href="/pricing">Pricing</a> page and start checkout. We record the
    version you agreed to and the time you agreed.
  </p>

  <h2>What you get</h2>
  <p>
    VetNotes Pro gives the account that bought it the Pro features listed on the
    <a href="/pricing">Pricing</a> page. VetNotes drafts clinical notes for you to review before you
    use them.
  </p>

  <h2>Price and billing</h2>
  <ul>
    <li>VetNotes Pro costs A$49 per month.</li>
    <li>Payment is taken by Stripe, monthly in advance, from the card you give at checkout.</li>
    <li>The subscription renews each month until you cancel it.</li>
  </ul>

  <h2>Cancelling</h2>
  <p>
    You can cancel at any time with <strong>Manage subscription</strong> on the
    <a href="/pricing">Pricing</a> page. You do not need to contact us. When you cancel, Pro stays
    active until the end of the period you have already paid for, and you are not charged again.
  </p>

  <h2>Refunds</h2>
  <p>See the <a href="/refunds">Refund Policy</a>.</p>

  <h2>Your consumer rights</h2>
  <p>
    Nothing in these terms excludes, restricts or modifies any right or remedy you have under the
    Australian Consumer Law.
  </p>

  <h2>Privacy</h2>
  <p>See the <a href="/privacy">Privacy</a> page for how your information is handled.</p>

  <h2>Contact</h2>
  <p>
    Email <a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a> or
    <a href="/tickets">open a support ticket</a>.
  </p>
</LegalPage>
