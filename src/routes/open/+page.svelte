<script lang="ts">
    /*
     * The free VetNotes reader (aiva.md §6: "it's like pdf the free version includes
     * reader functions"). Open, check, read, print and copy a VetNotes file: no account,
     * no charge, and the file never leaves this computer (read in the browser, held in
     * memory only, never uploaded or stored).
     */
    import { integrityMessage, MAX_FILE_BYTES, readVetnotesFile, type ReaderOutcome } from '$lib/vetRecord/reader';

    const KIND_TITLE: Record<string, string> = {
        referral: 'Referral',
        transfer: 'Transfer of records',
        history: 'Clinical history',
        passport: 'Pet health passport',
    };

    let outcome = $state<ReaderOutcome | null>(null);
    let fileName = $state<string | null>(null);
    let busy = $state(false);
    let dragging = $state(false);
    let copied = $state(false);
    let input = $state<HTMLInputElement | null>(null);

    const integrity = $derived(outcome?.kind === 'record' ? integrityMessage(outcome.integrity) : null);

    async function openFile(file: File | null | undefined) {
        if (!file) return;
        busy = true;
        copied = false;
        fileName = file.name;
        try {
            outcome = file.size > MAX_FILE_BYTES
                ? { kind: 'unreadable', message: 'This file is too large to be a VetNotes file.' }
                : await readVetnotesFile(await file.text());
        } catch {
            outcome = { kind: 'unreadable', message: 'This file could not be read.' };
        } finally {
            busy = false;
            if (input) input.value = '';
        }
    }

    function onDrop(e: DragEvent) {
        e.preventDefault();
        dragging = false;
        openFile(e.dataTransfer?.files?.[0]);
    }

    async function copyText() {
        if (outcome?.kind !== 'record') return;
        try {
            await navigator.clipboard.writeText(outcome.text);
            copied = true;
        } catch {
            copied = false;
            alert('This browser blocked copying. Select the text below and copy it instead.');
        }
    }

    function reset() {
        outcome = null;
        fileName = null;
        copied = false;
    }

    function madeOn(iso: string): string {
        const d = new Date(iso);
        return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    }
</script>

<svelte:head>
    <title>Open a VetNotes file — free reader | VetNotes</title>
    <meta name="description" content="Open, check, print and copy a VetNotes referral or history file. Free, no account, and the file never leaves your computer." />
</svelte:head>

<div class="min-h-screen bg-slate-50 text-slate-900">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <header class="space-y-2 print:hidden">
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight">Open a VetNotes file</h1>
            <p class="text-slate-600">
                Read a referral or history another clinic sent you: the original notes word for word, with who wrote
                them and when. <strong>Free, no account.</strong> The file stays on this computer; nothing is uploaded.
            </p>
        </header>

        {#if !outcome}
            <label
                class="block rounded-xl border-2 border-dashed px-6 py-12 text-center cursor-pointer transition-colors print:hidden {dragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-white hover:border-slate-400'}"
                ondragover={(e) => { e.preventDefault(); dragging = true; }}
                ondragleave={() => (dragging = false)}
                ondrop={onDrop}
                data-testid="open-dropzone"
            >
                <input
                    bind:this={input}
                    type="file"
                    accept=".vet,application/json"
                    class="sr-only"
                    onchange={(e) => openFile((e.currentTarget as HTMLInputElement).files?.[0])}
                    data-testid="open-input"
                />
                <span class="block text-lg font-semibold">{busy ? 'Reading…' : 'Choose a .vet file, or drop it here'}</span>
                <span class="mt-1 block text-sm text-slate-500">VetNotes files are made by VetSorcery and VetNotes.</span>
            </label>
        {:else}
            <div class="flex flex-wrap items-center gap-2 print:hidden">
                <span class="text-sm text-slate-500 truncate max-w-full" data-testid="open-filename">{fileName}</span>
                <span class="flex-1"></span>
                {#if outcome.kind === 'record'}
                    <button type="button" class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-100" onclick={() => window.print()} data-testid="open-print">
                        Print or save as PDF
                    </button>
                    <button type="button" class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-100" onclick={copyText} data-testid="open-copy">
                        {copied ? 'Copied' : 'Copy as text'}
                    </button>
                {/if}
                <button type="button" class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-100" onclick={reset} data-testid="open-another">
                    Open another file
                </button>
            </div>

            {#if outcome.kind === 'record'}
                <article id="vetnotes-record" class="rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="open-record">
                    <div class="border-b border-slate-200 px-5 py-4 space-y-1">
                        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{KIND_TITLE[outcome.record.kind] ?? outcome.record.kind}</p>
                        <p class="text-lg font-bold">{outcome.record.subject.name ?? 'Patient name not recorded'}</p>
                        <p class="text-sm text-slate-600">
                            From {outcome.record.issuer.clinic.name}{outcome.record.issuer.author.name ? ` · ${outcome.record.issuer.author.name}` : ''} · made {madeOn(outcome.record.created_at)}
                        </p>
                        {#if integrity}
                            <p
                                role="status"
                                class="mt-2 rounded-md px-3 py-2 text-sm font-medium {integrity.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}"
                                data-testid="open-integrity"
                            >
                                {integrity.ok ? '✓ ' : '⚠ '}{integrity.text}
                            </p>
                        {/if}
                    </div>
                    <pre class="whitespace-pre-wrap break-words px-5 py-4 font-sans text-[15px] leading-relaxed text-slate-800" data-testid="open-text">{outcome.text}</pre>
                </article>
            {:else if outcome.kind === 'invalid'}
                <div role="alert" class="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-900" data-testid="open-invalid">
                    <p class="font-semibold">This file doesn't follow the VetNotes format, so it isn't shown.</p>
                    <p class="mt-1 text-sm">Ask the sender for a new copy. What is wrong:</p>
                    <ul class="mt-2 list-disc pl-5 text-sm font-mono">
                        {#each outcome.errors.slice(0, 12) as error}
                            <li>{error}</li>
                        {/each}
                    </ul>
                </div>
            {:else}
                <div role="alert" class="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900" data-testid="open-message">
                    {outcome.message}
                </div>
            {/if}
        {/if}
    </div>
</div>

<style>
    /* Print only the record: the site nav and chat are outside this page. */
    @media print {
        :global(body *) {
            visibility: hidden;
        }
        :global(#vetnotes-record),
        :global(#vetnotes-record *) {
            visibility: visible;
        }
        :global(#vetnotes-record) {
            position: absolute;
            inset: 0 auto auto 0;
            width: 100%;
            border: none;
            box-shadow: none;
        }
    }
</style>
