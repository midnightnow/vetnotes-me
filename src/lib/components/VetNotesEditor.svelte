<script lang="ts">
    import { onMount, onDestroy, afterUpdate } from "svelte";
    import {
        structureToSOAP,
        formatSOAPAsText,
        type SOAPNote,
        pushToPIMS,
    } from "$lib/services/aiva";
    import { structureViaGemini } from "$lib/services/gemini";
    import { redactPII } from "$lib/utils/redactor";
    import { SOAP_TEMPLATES, FREE_TEMPLATE_KEYS } from "$lib/data/templates";
    import {
        ShorthandEngine,
        type AxisType,
    } from "$lib/services/ShorthandEngine";
    import AxisPickerModal from "$lib/components/AxisPickerModal.svelte";
    import AuthButton from "$lib/components/AuthButton.svelte";
    import {
        volatileBillingTray,
    } from "$lib/stores/VolatileStore";
    import { player } from "$lib/stores/player";
    import { user, isAuthenticated, initAuth } from "$lib/stores/auth";
    import ReferenceSidebar from "$lib/components/ReferenceSidebar.svelte";
    import ProButton from "$lib/components/ProButton.svelte";
    import PatientPicker from "$lib/components/PatientPicker.svelte";
    import { selectedPatient } from "$lib/stores/patients";
    import { isPro } from "$lib/stores/clinic";
    import { theme, THEMES } from "$lib/stores/theme";
    import { decodePayload } from "$lib/utils/encoding";
    import {
        saveDraft,
        loadDraft,
        clearDraft,
        purgeLegacyDraft,
    } from "$lib/utils/draftStorage";
    import { fade, slide } from "svelte/transition";

    let isRecording = false;
    let isProcessing = false;
    let transcript = "";
    let rawTranscript = "";
    let status = "Ready for Consult";
    let elapsedTime = 0;
    let keyInsights = 0;
    let isPushing = false;
    let recognition: any = null;
    let interimTranscript = "";
    let showSettings = false;
    let aivaApiKey = "";

    let mediaRecorder: MediaRecorder | null = null;
    let audioChunks: Blob[] = [];
    let timerInterval: any = null;
    let soapNote: SOAPNote | null = null;

    let showTemplates = false;
    let sidebarCollapsed = true;
    let selectedTemplate = "wellness_exam";
    let activeAxisType: AxisType | null = null;
    let showAxisPicker = false;
    let activeTriggerRange = { start: 0, end: 0 };
    let importedBannerVisible = false;
    let importedData: any = null;

    // Subscribe to Billing
    let billingItems: any[] = [];
    volatileBillingTray.subscribe((items) => (billingItems = items));

    // ── Draft persistence (tab-scoped sessionStorage, PHI-safe) ──
    // See src/lib/utils/draftStorage.ts for the storage/TTL rationale.
    const UPGRADE_URL =
        "https://vetsorcery.com/pricing?utm_source=vetnotes&utm_medium=app&utm_campaign=upgrade_cta";
    let draftReady = false; // guard: don't persist until restore has run
    let draftRestored = false;
    let draftTimer: any = null;

    function persistDraft(raw: string, structured: string) {
        if (!draftReady) return;
        if (draftTimer) clearTimeout(draftTimer);
        draftTimer = setTimeout(() => saveDraft(raw, structured, selectedTemplate), 600);
    }
    $: persistDraft(rawTranscript, transcript);

    function restoreDraft() {
        purgeLegacyDraft(); // remove any unredacted draft a prior build left in localStorage
        const draft = loadDraft();
        if (draft && !rawTranscript.trim() && !transcript.trim()) {
            rawTranscript = draft.raw || "";
            transcript = draft.structured || "";
            if (draft.template) selectedTemplate = draft.template;
            draftRestored = true;
            status = "Draft restored from your last session";
        }
    }

    function discardDraft() {
        clearDraft();
        draftRestored = false;
        clearWorkspace();
    }

    onMount(async () => {
        initAuth();
        volatileBillingTray.restore();
        restoreDraft();
        draftReady = true;

        // === Imaging Hub Import Receiver ===
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const source = urlParams.get('source');
            const encodedPackage = urlParams.get('package');

            if (source === 'imaging' && encodedPackage) {
                try {
                    const study = decodePayload<any>(encodedPackage);
                    importedData = study;

                    let compiled = `--- IMPORTED RADIOGRAPHIC STUDY (ID: ${study.studyId.slice(-6)}) ---\n\n`;
                    
                    if (study.signalment) {
                        const { species, breed, age, sex } = study.signalment;
                        compiled += `[SIGNALMENT] ${age || 'N/A'}yo ${sex || ''} ${breed || 'Mixed'} ${species || 'Unknown'}\n\n`;
                    }

                    compiled += `[FINDINGS]\n${study.findings || 'No summary available.'}\n\n`;
                    
                    if (study.triageResults) {
                        compiled += `[VIEW OBSERVATIONS]\n`;
                        Object.entries(study.triageResults).forEach(([id, res]: [string, any]) => {
                            const detail = res.description || res.summary || 'Triage complete';
                            compiled += `- Image ${id.slice(-6)}: ${detail}\n`;
                        });
                    }

                    rawTranscript = compiled;
                    transcript = compiled;
                    importedBannerVisible = true;
                    status = 'Imaging data imported';

                    // Clean URL
                    const url = new URL(window.location.href);
                    url.searchParams.delete('source');
                    url.searchParams.delete('package');
                    window.history.replaceState({}, '', url.pathname);
                } catch (err) {
                    console.error('Failed to parse imaging package:', err);
                }
            }
        }
        if (typeof window !== "undefined") {
            const storedKey = localStorage.getItem("aiva_api_key");
            if (storedKey) aivaApiKey = storedKey;
        }

        if (
            "webkitSpeechRecognition" in window ||
            "SpeechRecognition" in window
        ) {
            if (!draftRestored) status = "Ready for Consult";
        } else {
            if (!draftRestored) status = "Speech recognition not supported";
        }
    });

    onDestroy(() => {
        if (timerInterval) clearInterval(timerInterval as any);
    });

    function formatTime(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, "0")}`;
    }

    // ── Speech recognition helpers ──────────────────────────────────────────
    // We create a fresh SpeechRecognition instance each recording session so
    // there is no carry-over of result buffers from prior sessions.
    // Chrome auto-stops the recognizer after ~60s of silence; we restart it
    // transparently so long recordings keep working.

    function buildRecognizer(): any {
        if (typeof window === 'undefined') return null;
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) return null;

        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        // Prefer en-AU for Australian vets; falls back gracefully in other locales
        rec.lang = navigator.language?.startsWith('en') ? navigator.language : 'en-AU';
        rec.maxAlternatives = 1;

        rec.onresult = (event: any) => {
            // event.resultIndex is the index of the first NEW result in this event.
            // Only iterate from there — never re-read prior results.
            let newFinal = "";
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const text = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    newFinal += text + " ";
                } else {
                    interim = text; // only keep the latest interim
                }
            }
            if (newFinal) rawTranscript += newFinal;
            interimTranscript = interim;
        };

        rec.onerror = (e: any) => {
            // 'no-speech' and 'audio-capture' are recoverable — ignore them
            if (e.error === 'not-allowed') {
                status = "Microphone blocked — allow mic access in your browser";
                isRecording = false;
            }
        };

        // Auto-restart: Chrome stops the recognizer after silence.
        // Restart it as long as we're still recording.
        rec.onend = () => {
            if (isRecording) {
                try { rec.start(); } catch { /* already started */ }
            }
        };

        return rec;
    }

    async function toggleRecording() {
        if (!isRecording) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                // Fresh recognizer — no result carry-over from previous sessions
                recognition = buildRecognizer();
                rawTranscript = "";
                interimTranscript = "";

                if (recognition) recognition.start();

                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                elapsedTime = 0;
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) audioChunks.push(event.data);
                };
                mediaRecorder.onstop = async () => {
                    // Stop recognizer before processing so onend doesn't restart it
                    isRecording = false;
                    if (recognition) { recognition.onend = null; recognition.stop(); recognition = null; }
                    await processRecording();
                };
                mediaRecorder.start(1000);
                isRecording = true;
                status = "Listening...";
                timerInterval = setInterval(() => { elapsedTime++; }, 1000);
            } catch (err) {
                console.error("Mic error:", err);
                status = "Microphone blocked — allow mic access in your browser";
            }
        } else {
            if (mediaRecorder) {
                mediaRecorder.stop();
                mediaRecorder.stream.getTracks().forEach((track) => track.stop());
            }
            if (timerInterval) {
                clearInterval(timerInterval as any);
                timerInterval = null;
            }
            // isRecording is set to false inside mediaRecorder.onstop above
        }
    }

    async function processRecording() {
        isProcessing = true;
        status = "Processing...";
        try {
            if (!rawTranscript.trim()) {
                status = "No speech detected";
                isProcessing = false;
                return;
            }
            const redactedTranscript = redactPII(rawTranscript);
            try {
                soapNote = await structureViaGemini(redactedTranscript, aivaApiKey);
                status = "Structured via Cloud AI";
            } catch (e) {
                soapNote = await structureToSOAP(redactedTranscript, false);
                status = "Structured via Local AI";
            }
            transcript = formatSOAPAsText(soapNote!);
            keyInsights = (soapNote?.missedCharges?.length || 0);
        } catch (error) {
            status = "Processing Failed";
        } finally {
            isProcessing = false;
        }
    }

    function copyToClipboard() {
        navigator.clipboard.writeText(transcript);
        status = "Copied to Clipboard";
    }

    function exportToVet() {
        if (!soapNote) return;
        const doc = {
            version: "1.1",
            type: "soap_note",
            id: `vet_${Date.now()}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            source: "vetnotes",
            patient: {
                id: $selectedPatient?.id || "unknown",
                species: $selectedPatient?.species || "canine",
                ...($selectedPatient?.name ? { name: $selectedPatient.name } : {}),
                ...($selectedPatient?.breed ? { breed: $selectedPatient.breed } : {})
            },
            data: soapNote
        };
        const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `consult_${Date.now()}.vet`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        status = "Exported .vet file";
    }

    async function handlePushToPIMS() {
        if (!soapNote) return;
        if (!$isAuthenticated) {
            status = "Sign in to sync with PIMS";
            return;
        }
        isPushing = true;
        status = "Syncing with PIMS...";
        try {
            const result = await pushToPIMS(soapNote, "ezyvet", {
                patientId: $selectedPatient?.id || undefined,
                patientName: $selectedPatient?.name || undefined,
                species: $selectedPatient?.species || undefined,
                template: selectedTemplate,
                rawTranscript: rawTranscript
            });
            if (result.success) {
                status = "Synced Successfully";
                player.completeConsultation();
            } else {
                status = result.message || "PIMS Sync Failed";
            }
        } catch (error) {
            status = "Connection Error";
        } finally {
            isPushing = false;
        }
    }

    function clearWorkspace() {
        transcript = "";
        rawTranscript = "";
        soapNote = null;
        keyInsights = 0;
        elapsedTime = 0;
        status = "Ready for Consult";
        draftRestored = false;
        volatileBillingTray.clear();
        clearDraft();
    }

    function confirmClearWorkspace() {
        if (
            (rawTranscript.trim() || transcript.trim()) &&
            !window.confirm("Clear the current note? This can't be undone.")
        ) {
            return;
        }
        clearWorkspace();
    }

    function handleEditorInput(e: Event) {
        const target = e.target as HTMLTextAreaElement;
        const val = target.value;
        const cursor = target.selectionStart;
        const lookback = val.substring(Math.max(0, cursor - 15), cursor);
        const matches = ShorthandEngine.scan(lookback);
        if (matches.length > 0) {
            const match = matches[matches.length - 1];
            if (lookback.endsWith(match.trigger)) {
                activeAxisType = match.axis as AxisType;
                activeTriggerRange = { start: cursor - match.trigger.length, end: cursor };
                showAxisPicker = true;
            }
        }
        rawTranscript = val;
    }

    function handleAxisSave(event: CustomEvent<Record<string, string>>) {
        if (!activeAxisType) return;
        const expansion = ShorthandEngine.expand(activeAxisType, event.detail);
        const pre = rawTranscript.substring(0, activeTriggerRange.start);
        const post = rawTranscript.substring(activeTriggerRange.end);
        rawTranscript = pre + expansion + post;
        transcript = rawTranscript;
        showAxisPicker = false;
        activeAxisType = null;
    }

    afterUpdate(() => {
        const soapBox = document.getElementById("soap-stream-box");
        if (soapBox) soapBox.scrollTop = soapBox.scrollHeight;
    });

    // Templates — Pro users get all, free tier gets core templates
    // FREE_TEMPLATE_KEYS is the canonical list defined in templates.ts
    $: visibleTemplates = $isPro
        ? Object.keys(SOAP_TEMPLATES)
        : FREE_TEMPLATE_KEYS as string[];
</script>

<svelte:head>
    <title>VetNotes | Clinical Workflow</title>
</svelte:head>

<svelte:window
    on:keydown={(e) => { if (e.key === "Escape" && showSettings) showSettings = false; }}
    on:beforeunload={(e) => { if (isRecording) { e.preventDefault(); e.returnValue = ""; } }}
/>

<div class={$theme === "nightshift" ? "nightshift" : "daylight"}>
<div class="max-w-6xl mx-auto px-6 py-8">
    <header class="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
        <div class="flex items-center space-x-4">
            <div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                <span class="text-white font-bold">VN</span>
            </div>
            <div>
                <h1 class="text-xl font-bold tracking-tight text-white/90">
                    VetNotes<span class="text-blue-400">.me</span>
                </h1>
                <p class="text-[11px] text-white/40">
                    Open-source clinical documentation
                </p>
            </div>
        </div>

        <div class="flex items-center space-x-4">
            <button
                class="text-white/40 hover:text-white transition-colors"
                aria-label={$theme === "nightshift" ? "Switch to Daylight theme" : "Switch to Night Shift theme"}
                title={$theme === "nightshift" ? "Switch to Daylight" : "Switch to Night Shift"}
                on:click={() => theme.set($theme === "nightshift" ? "daylight" : "nightshift")}
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24">
                    {#if $theme === "nightshift"}
                        <circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4"/>
                    {:else}
                        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>
                    {/if}
                </svg>
            </button>
            <button class="text-xs text-white/40 hover:text-white transition-colors" on:click={() => (showSettings = true)}>Settings</button>
            {#if !$isAuthenticated || !$isPro}
                <ProButton size="sm" on:click={() => window.open(UPGRADE_URL, "_blank", "noopener")}>Upgrade to Pro</ProButton>
            {/if}
            <AuthButton />
        </div>
    </header>

    {#if showSettings}
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center" on:click|self={() => (showSettings = false)}>
            <div class="bg-gray-900 border border-white/10 p-8 rounded-2xl w-full max-w-md shadow-2xl relative" role="dialog" aria-modal="true" aria-label="AI settings">
                <button class="absolute top-4 right-4 text-white/40 hover:text-white" aria-label="Close settings" on:click={() => (showSettings = false)}>
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                <h2 class="text-xl font-bold mb-4">Settings</h2>
                <p class="text-xs text-white/40 font-semibold mb-2">Appearance</p>
                <div class="grid grid-cols-2 gap-2 mb-6">
                    {#each THEMES as t}
                        <button
                            class="text-left px-3 py-2 rounded-lg border text-xs transition-all {$theme === t.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'}"
                            on:click={() => theme.set(t.id)}
                        >
                            <span class="font-semibold block">{t.label}</span>
                            <span>{t.blurb}</span>
                        </button>
                    {/each}
                </div>
                <p class="text-xs text-white/40 font-semibold mb-2">AI</p>
                <p class="text-xs text-white/40 mb-6 leading-relaxed">
                    Cloud SOAP structuring is included with VetNotes — there is nothing to set up here.
                    If you'd rather run AI usage through your own Google AI account, paste a
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" class="text-blue-400 underline">Gemini API key</a>
                    below and it will be used instead of ours.
                </p>
                <div class="space-y-4">
                    <div>
                        <label for="gemini-key-input" class="block text-xs text-gray-500 font-semibold mb-2">Your Gemini API key (optional)</label>
                        <!-- svelte-ignore a11y-autofocus -->
                        <input id="gemini-key-input" type="password" autofocus bind:value={aivaApiKey} placeholder="Paste key, or leave empty to use the built-in one" class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"/>
                    </div>
                </div>
                <div class="mt-8 flex justify-end">
                    <button class="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-semibold transition-colors" on:click={() => { localStorage.setItem("aiva_api_key", aivaApiKey); showSettings = false; }}>Save</button>
                </div>
            </div>
        </div>
    {/if}

    <main class="grid gap-6">
        <!-- Collapsible sidebar strip — shown as a row at top on desktop -->
        <div class="flex items-center gap-3 flex-wrap">
            <div class="flex items-center gap-2 text-xs text-white/50">
                <span class="w-2 h-2 rounded-full shrink-0 {isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'}"></span>
                <span class="font-semibold">{status}</span>
            </div>
            {#if draftRestored}
                <button on:click={discardDraft} class="text-xs text-white/40 underline hover:text-white transition-colors">Discard draft</button>
            {/if}
            <div class="ml-auto flex items-center gap-2 text-xs text-white/30">
                <span>✓ Local transcription</span>
                <span>✓ PII redaction</span>
                {#if $isAuthenticated}<span class="text-blue-400">✓ Cloud sync</span>{/if}
            </div>
            <button on:click={confirmClearWorkspace} class="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white text-xs font-semibold transition-all">Clear workspace</button>
        </div>

        <section class="flex flex-col gap-6">
            <!-- Patient Picker -->
            <PatientPicker />

            {#if importedBannerVisible}
                <div 
                    transition:slide
                    class="relative z-50 p-4 rounded-2xl border border-sky-200/50 bg-sky-50/80 backdrop-blur-xl shadow-xl shadow-sky-900/5 flex items-center justify-between"
                >
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 2 0 01.707.293l5.414 5.414a1 2 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div>
                            <h4 class="text-sm font-black text-sky-900 uppercase tracking-tight">Clinical Evidence Imported</h4>
                            <p class="text-xs text-sky-700 font-medium">Study findings and observations have been loaded into your editor.</p>
                        </div>
                    </div>
                    <button 
                        on:click={() => importedBannerVisible = false}
                        class="p-2 hover:bg-sky-200/50 rounded-full transition-colors text-sky-500"
                    >
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            {/if}

            <!-- ── Clinical Intelligence panel ── -->
            <div class="glass-panel rounded-3xl p-6 flex flex-col gap-5">

                <!-- Header: title + template toggle + action buttons -->
                <div class="flex flex-wrap items-center gap-3">
                    <h3 class="text-lg font-bold text-white/90 tracking-tight mr-auto">Clinical Intelligence</h3>

                    <!-- Template toggle — shows selected name, opens picker -->
                    <div class="relative">
                        <button
                            on:click={() => showTemplates = !showTemplates}
                            class="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all
                                   {showTemplates ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'}"
                        >
                            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"/></svg>
                            {SOAP_TEMPLATES[selectedTemplate as keyof typeof SOAP_TEMPLATES]?.name ?? "Template"}
                            <svg class="w-3 h-3 transition-transform {showTemplates ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                        </button>

                        {#if showTemplates}
                            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                            <div
                                class="absolute right-0 top-full mt-1 z-40 glass-panel rounded-2xl p-2 min-w-[180px] shadow-xl"
                                transition:fade={{ duration: 120 }}
                            >
                                {#each Object.entries(SOAP_TEMPLATES).filter(([k]) => visibleTemplates.includes(k)) as [key, template]}
                                    <button
                                        on:click={() => { selectedTemplate = key; showTemplates = false; }}
                                        class="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all {selectedTemplate === key ? 'bg-blue-600 text-white' : 'text-white/60 hover:bg-white/10'}"
                                    >
                                        {template.name}
                                    </button>
                                {/each}
                                {#if !$isPro}
                                    <p class="text-[9px] text-blue-400/60 px-3 pt-2 pb-1 border-t border-white/5 mt-1">More in Pro tier</p>
                                {/if}
                            </div>
                        {/if}
                    </div>

                    <button on:click={exportToVet} disabled={!soapNote} class="px-3 py-1.5 text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all disabled:opacity-40">Export .vet</button>
                    <button on:click={copyToClipboard} disabled={!transcript} class="px-3 py-1.5 text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all disabled:opacity-40">Copy Note</button>
                    <button
                        on:click={handlePushToPIMS}
                        disabled={!transcript || isPushing || !$isAuthenticated}
                        title={!$isAuthenticated ? 'Sign in to sync with PIMS' : ''}
                        class="px-3 py-1.5 text-xs font-semibold {isPushing ? 'bg-blue-800' : !$isAuthenticated ? 'bg-gray-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'} rounded-xl transition-all shadow-lg disabled:opacity-40"
                    >
                        {isPushing ? "Syncing…" : "Sync to PIMS"}
                    </button>
                </div>

                <!-- ── Mic trigger + live transcript (full width, large) ── -->
                <div class="rounded-2xl border border-white/5 overflow-hidden {isRecording ? 'bg-red-950/20 border-red-500/20' : 'bg-black/10'}">
                    <!-- Mic row -->
                    <div class="flex items-center gap-4 px-5 py-4">
                        <button
                            on:click={toggleRecording}
                            aria-label={isRecording ? "Stop recording" : "Start recording"}
                            class="w-12 h-12 shrink-0 rounded-full flex items-center justify-center transition-all
                                   {isRecording ? 'bg-red-500 shadow-lg shadow-red-500/30' : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20'}"
                        >
                            {#if isRecording}
                                <div class="w-4 h-4 bg-white rounded-sm animate-pulse"></div>
                            {:else}
                                <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8h-2a5 5 0 01-10 0H3a7.001 7.001 0 006 6.93V17H6v2h8v-2h-3v-2.07z"/></svg>
                            {/if}
                        </button>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-bold text-white/90">{isRecording ? "Recording — speak naturally" : "New consult"}</p>
                            <p class="text-xs text-white/40">{isRecording ? "Tap the square to stop" : "Tap the microphone to start"}</p>
                        </div>
                        <div class="text-right shrink-0">
                            <span class="block text-lg font-bold font-mono {isRecording ? 'text-red-400' : 'text-white/40'}">{formatTime(elapsedTime)}</span>
                            <span class="text-[10px] text-white/20">elapsed</span>
                        </div>
                    </div>

                    <!-- Live transcript — large, prominent, always visible while recording -->
                    {#if isRecording || rawTranscript}
                        <div class="border-t border-white/5 px-5 py-4 max-h-48 overflow-y-auto">
                            <p class="text-xs font-semibold text-white/30 mb-2 uppercase tracking-wider">Live transcript</p>
                            <p class="text-sm leading-relaxed text-white/80 whitespace-pre-wrap">
                                {rawTranscript || ""}
                                {#if interimTranscript}
                                    <span class="text-white/30 italic">{interimTranscript}</span>
                                {/if}
                            </p>
                            {#if !rawTranscript && isRecording}
                                <p class="text-white/20 italic text-sm">Waiting for speech…</p>
                            {/if}
                        </div>
                    {/if}
                </div>

                <!-- ── SOAP output area (full width) ── -->
                <div id="soap-stream-box" class="rounded-2xl bg-gray-50 text-gray-900 overflow-y-auto shadow-inner" style="min-height: 220px; max-height: 60vh;">
                    {#if transcript}
                        <div class="p-6 prose prose-sm max-w-none whitespace-pre-wrap font-sans leading-relaxed">{transcript}</div>
                    {:else if isProcessing}
                        <div class="flex flex-col items-center justify-center h-full min-h-[220px] space-y-3 opacity-40">
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <p class="text-xs">Generating clinical record…</p>
                        </div>
                    {:else}
                        <div class="flex flex-col items-center justify-center min-h-[220px] opacity-20 text-center p-6">
                            <svg class="w-10 h-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 2 0 01.707.293l5.414 5.414a1 2 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                            <p class="text-sm">SOAP note will appear here after recording</p>
                        </div>
                    {/if}
                </div>

            </div>

            <!-- ── Manual clinical editor ── -->
            <div class="glass-panel rounded-3xl overflow-hidden flex flex-col" style="min-height: 280px;">
                <div class="bg-white/5 px-6 py-3 flex justify-between items-center border-b border-white/5">
                    <span class="text-xs font-semibold text-white/40">Manual clinical editor</span>
                    <button on:click={confirmClearWorkspace} class="text-xs font-semibold text-white/20 hover:text-white/60 transition-colors">Clear all</button>
                </div>
                <div class="flex flex-1">
                    <textarea bind:value={rawTranscript} on:input={handleEditorInput} class="flex-grow bg-transparent p-6 font-mono text-sm leading-relaxed text-white/80 focus:outline-none resize-none" placeholder="Draft clinical notes here..."></textarea>
                    <div class="w-56 border-l border-white/5 p-4 bg-black/20 hidden lg:block">
                        <ReferenceSidebar transcript={transcript || rawTranscript} />
                    </div>
                </div>
            </div>
        </section>
    </main>

    <footer class="mt-20 mb-12 text-center">
        <p class="text-white/20 text-xs">VetNotes Web &copy; 2026 · Built for clinicians</p>
    </footer>

    <AxisPickerModal type={activeAxisType || "pathology"} isOpen={showAxisPicker} on:save={handleAxisSave} on:cancel={() => { showAxisPicker = false; activeAxisType = null; }} />
</div>
</div>

<style>
    .glass-panel {
        background: var(--t-surface, #ffffff);
        border: 1px solid var(--t-border, #e3ded2);
        box-shadow: var(--t-panel-shadow, 0 1px 3px rgba(46, 60, 52, 0.07));
    }
    textarea::-webkit-scrollbar { width: 6px; }
    textarea::-webkit-scrollbar-thumb { background: var(--t-scrollbar, #d8d3c6); border-radius: 10px; }
</style>
