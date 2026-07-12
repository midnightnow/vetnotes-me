<script lang="ts">
  import dayjs from 'dayjs';
  let { data } = $props();
</script>

<svelte:head>
  <title>Verify CPD Record — VetNotes CPD</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="wrap">
  <div class="card">
    <div class="brand">VetNotes <span>CPD</span></div>

    {#if data.valid}
      <div class="badge valid">✓ Verified record</div>
      <dl>
        <dt>Holder</dt>
        <dd>{data.holder}</dd>
        <dt>Activity</dt>
        <dd>{data.module}</dd>
        <dt>CPD hours (self-directed)</dt>
        <dd>{data.hours.toFixed(1)} hours</dd>
        <dt>Completed</dt>
        <dd>{dayjs(data.completedAt).format('DD MMMM YYYY')}</dd>
        <dt>Verification ID</dt>
        <dd class="mono">{data.recordId}</dd>
      </dl>
      <p class="note">
        This confirms a self-directed CPD completion record held by VetNotes CPD. It is a
        record of self-directed activity, not an accredited award.
      </p>
    {:else}
      <div class="badge invalid">✕ No record found</div>
      <p class="note">
        No completed CPD record matches the ID <span class="mono">{data.recordId}</span>. Check
        the ID exactly as printed on the certificate.
      </p>
    {/if}
  </div>
</div>

<style>
  .wrap {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    padding: 2rem;
    font-family: system-ui, -apple-system, sans-serif;
  }
  .card {
    background: #fff;
    max-width: 30rem;
    width: 100%;
    border-radius: 16px;
    box-shadow: 0 10px 40px rgba(15, 23, 42, 0.08);
    padding: 2.5rem;
  }
  .brand {
    font-weight: 900;
    font-style: italic;
    font-size: 1.75rem;
    color: #1e3a8a;
    margin-bottom: 1.5rem;
  }
  .brand span { color: #64748b; font-style: normal; font-weight: 700; }
  .badge {
    display: inline-block;
    padding: 0.4rem 0.9rem;
    border-radius: 999px;
    font-weight: 700;
    font-size: 0.85rem;
    margin-bottom: 1.5rem;
  }
  .valid { background: #dcfce7; color: #166534; }
  .invalid { background: #fee2e2; color: #991b1b; }
  dl { display: grid; grid-template-columns: 1fr; gap: 0.25rem; margin: 0 0 1.5rem; }
  dt { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-top: 0.75rem; }
  dd { margin: 0; font-size: 1.05rem; font-weight: 600; color: #0f172a; }
  .mono { font-family: ui-monospace, monospace; font-size: 0.8rem; font-weight: 500; word-break: break-all; }
  .note { font-size: 0.8rem; color: #64748b; line-height: 1.5; }
</style>
