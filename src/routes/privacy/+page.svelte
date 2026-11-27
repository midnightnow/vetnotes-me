<script lang="ts">
  /* ═══════════════════════════════════════════════════════════════════════
   * DRAFT — NOT REVIEWED. DO NOT DEPLOY UNTIL THE OWNER AND A LAWYER HAVE
   * READ AND APPROVED THIS TEXT.
   *
   * Drafted on 2026-11-27 from what the code in this repository does. No
   * lawyer has written or read it, and it has not been checked against the
   * Privacy Act 1988 or the Australian Privacy Principles.
   *
   * Facts used, and where each comes from:
   *   - Operator: AIVA Pty Ltd, ABN 85 693 383 292 (owner).
   *   - Sign-in by Firebase Authentication, with Google or email and password
   *     (`src/lib/stores/auth.ts`, `src/hooks.server.ts`).
   *   - Payments by Stripe Checkout; this app never receives card numbers. It
   *     stores the Stripe customer and subscription ids, the checkout email,
   *     whether Pro is active, and the Terms version and time agreed
   *     (`src/lib/server/pro_entitlement.ts`, `pro_billing.ts`).
   *   - Speech-to-text, redaction, cloud and local structuring, Firestore:
   *     README.md, "How your data is handled (accurately)".
   *   - Unfinished drafts in the tab's sessionStorage, cleared when the tab
   *     closes (`src/lib/utils/draftStorage.ts`).
   *   - Google Analytics on vetnotes.me (`src/lib/analytics/`).
   *   - Support tickets stored with the sender's email
   *     (`src/routes/tickets/+page.svelte`).
   *
   * Undecided or unverified — the page is worded so it stays true without these:
   *   TODO(owner): how long each kind of information is kept. Not stated.
   *   TODO(owner): where data is stored and whether it leaves Australia. Not stated.
   *   TODO(lawyer): Privacy Act / APP statements, and the access, correction
   *     and complaints process. The page only gives a contact address.
   *   TODO(owner): what the support chat sends to an AI service. The page
   *     covers support tickets only.
   *   TODO(owner): cookies and any other analytics or tracking not found in
   *     this repository.
   *   TODO(owner): confirm support@vetsorcery.com is a monitored mailbox.
   * ═══════════════════════════════════════════════════════════════════════ */
  import LegalPage from '$lib/components/LegalPage.svelte';
  import { SELLER_ABN, SELLER_NAME, SUPPORT_EMAIL } from '$lib/constants/legal';
</script>

<svelte:head>
  <title>Privacy | VetNotes</title>
  <meta name="description" content="What information VetNotes handles and where it goes." />
</svelte:head>

<LegalPage title="Privacy">
  <p>
    VetNotes (vetnotes.me) is provided by {SELLER_NAME}, ABN {SELLER_ABN}. This page says what
    information VetNotes handles and where it goes.
  </p>

  <h2>Signing in</h2>
  <p>
    Sign-in is handled by Google's Firebase Authentication. You can sign in with Google or with an
    email address and password. We receive your email address and, if you sign in with Google, the
    name and profile picture on your Google account.
  </p>

  <h2>Paying for VetNotes Pro</h2>
  <p>
    Payments are handled by Stripe. You enter your card details on Stripe's pages, and VetNotes
    does not receive or store your card number. We keep a record that links your account to your
    Stripe customer and subscription, the email address used at checkout, whether Pro is active,
    and the version of the Terms you agreed to and when.
  </p>

  <h2>Consults and notes</h2>
  <ul>
    <li>
      <strong>Speech to text</strong> uses your browser's built-in speech recognition. In Chrome and
      Edge the browser sends the audio to the browser maker's speech service (Google or Microsoft).
      VetNotes cannot remove anything from the audio before that happens.
    </li>
    <li>
      <strong>Redaction</strong> runs in your browser on the transcript text. It scrubs client names,
      phone numbers and addresses before the text is sent for cloud structuring. It is automatic and
      may not catch everything.
    </li>
    <li>
      <strong>Cloud structuring</strong> (paid plans) sends the redacted transcript to the VetNotes
      server, which sends it to Google Vertex AI (Gemini) to draft the note.
    </li>
    <li>
      <strong>Local structuring</strong> (the free plan, or when cloud structuring is unavailable)
      happens in your browser.
    </li>
    <li>
      <strong>Unfinished drafts</strong> are kept in your browser tab so a reload does not lose them.
      They are cleared when you close the tab.
    </li>
    <li>
      <strong>Signed-in data</strong>, such as notes you sync, CPD records and your subscription
      record, is stored in Google Cloud Firestore.
    </li>
  </ul>

  <h2>Analytics</h2>
  <p>vetnotes.me uses Google Analytics to count page views.</p>

  <h2>Support</h2>
  <p>
    Support tickets you send are stored with your email address so we can reply to you.
  </p>

  <h2>Questions and requests</h2>
  <p>
    To ask what information we hold about you, or to ask us to correct or delete it, email
    <a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a> or
    <a href="/tickets">open a support ticket</a>.
  </p>
</LegalPage>
