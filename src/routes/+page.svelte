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

    let selectedTemplate = "wellness_exam";
    let activeAxisType: AxisType | null = null;
    let showAxisPicker = false;
    let activeTriggerRange = { start: 0, end: 0 };

    // Subscribe to Billing
    let billingItems: any[] = [];
    volatileBillingTray.subscribe((items) => (billingItems = items));

    onMount(async () => {
        initAuth();
        volatileBillingTray.restore();
        if (typeof window !== "undefined") {
            const storedKey = localStorage.getItem("aiva_api_key");
            if (storedKey) aivaApiKey = storedKey;
        }

        if (
            "webkitSpeechRecognition" in window ||
            "SpeechRecognition" in window
        ) {
            const SpeechRecognition =
                (window as any).SpeechRecognition ||
                (window as any).webkitSpeechRecognition;
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = "en-US";

            recognition.onresult = (event: any) => {
                let interim = "";
                let final = "";
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        final += transcript + " ";
                    } else {
                        interim += transcript;
                    }
                }
                if (final) {
                    rawTranscript += final;
                }
                interimTranscript = interim;
            };
            status = "Ready for Consult";
        } else {
            status = "Speech recognition not supported";
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

    async function toggleRecording() {
        if (!isRecording) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                });
                if (recognition) {
                    rawTranscript = "";
                    interimTranscript = "";
                    recognition.start();
                }
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                elapsedTime = 0;
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) audioChunks.push(event.data);
                };
                mediaRecorder.onstop = async () => {
                    if (recognition) recognition.stop();
                    await processRecording();
                };
                mediaRecorder.start(1000);
                isRecording = true;
                status = "Listening...";
                timerInterval = setInterval(() => {
                    elapsedTime++;
                }, 1000);
            } catch (err) {
                console.error("Mic error:", err);
                status = "Microphone access error";
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
            isRecording = false;
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
        volatileBillingTray.clear();
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
    <title>VetNotes | AI Scribe for Veterinarians — Voice-to-SOAP Notes</title>
    <meta name="description" content="Free AI scribe for vets. Record consultations and get structured SOAP notes instantly. Voice-to-text with local PII redaction. No account required." />
</svelte:head>

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
                <p class="text-[10px] text-white/40 font-mono tracking-widest uppercase">
                    Open Source Clinical Documentation
                </p>
            </div>
        </div>

        <div class="flex items-center space-x-4">
            <button class="text-xs text-white/40 hover:text-white transition-colors" on:click={() => (showSettings = true)}>Settings</button>
            {#if !$isAuthenticated || !$isPro}
                <ProButton size="sm" on:click={() => {}}>Upgrade to Pro</ProButton>
            {/if}
            <AuthButton />
        </div>
    </header>

    {#if showSettings}
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div class="bg-gray-900 border border-white/10 p-8 rounded-2xl w-full max-w-md shadow-2xl relative">
                <button class="absolute top-4 right-4 text-white/40 hover:text-white" on:click={() => (showSettings = false)}>
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                <h2 class="text-xl font-bold mb-4">AIVA Configuration</h2>
                <p class="text-xs text-white/40 mb-6 leading-relaxed">
                    Enter your AIVA API Key to enable premium cloud-based SOAP structuring.
                </p>
                <div class="space-y-4">
                    <div>
                        <label class="block text-[10px] uppercase text-gray-500 font-bold mb-2">API Key</label>
                        <input type="password" bind:value={aivaApiKey} placeholder="Enter your key..." class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"/>
                    </div>
                </div>
                <div class="mt-8 flex justify-end">
                    <button class="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-semibold transition-colors" on:click={() => { localStorage.setItem("aiva_api_key", aivaApiKey); showSettings = false; }}>Save Configuration</button>
                </div>
            </div>
        </div>
    {/if}

    <main class="grid lg:grid-cols-4 gap-8">
        <aside class="space-y-6">
            <div class="glass-panel rounded-3xl p-6 space-y-6">
                <div>
                    <p class="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-4">Connection Status</p>
                    <div class="flex items-center space-x-3">
                        <span class="w-2 h-2 rounded-full {isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'}"></span>
                        <p class="text-xs font-bold text-white/80">{status}</p>
                    </div>
                </div>

                <div class="pt-6 border-t border-white/5">
                    <p class="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-4">Privacy & Security</p>
                    <div class="space-y-2">
                        <div class="flex items-center space-x-2 text-[10px] text-white/60">
                            <span class="text-green-500">✓</span>
                            <span>Local Transcription</span>
                        </div>
                        <div class="flex items-center space-x-2 text-[10px] text-white/60">
                            <span class="text-green-500">✓</span>
                            <span>Zero Data Retention</span>
                        </div>
                        <div class="flex items-center space-x-2 text-[10px] text-white/60">
                            <span class="text-green-500">✓</span>
                            <span>PII Redaction Active</span>
                        </div>
                        {#if $isAuthenticated}
                            <div class="flex items-center space-x-2 text-[10px] text-white/60">
                                <span class="text-blue-400">✓</span>
                                <span>Cloud Sync Enabled</span>
                            </div>
                        {/if}
                    </div>
                </div>

                <div class="pt-6 border-t border-white/5 flex flex-col gap-3">
                    <button on:click={clearWorkspace} class="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all">Clear Workspace</button>
                </div>
            </div>
        </aside>

        <section class="lg:col-span-3 space-y-8">
            <!-- Patient Picker -->
            <PatientPicker />

            <div class="glass-panel rounded-3xl p-8 min-h-[400px] flex flex-col">
                <div class="flex justify-between items-center mb-8">
                    <h3 class="text-xl font-bold text-white/90 tracking-tight">Clinical Intelligence</h3>
                    <div class="flex space-x-3">
                        <button on:click={exportToVet} disabled={!soapNote} class="px-4 py-2 text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all disabled:opacity-50">Export .vet</button>
                        <button on:click={copyToClipboard} disabled={!transcript} class="px-4 py-2 text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all disabled:opacity-50">Copy Note</button>
                        <button
                            on:click={handlePushToPIMS}
                            disabled={!transcript || isPushing || !$isAuthenticated}
                            title={!$isAuthenticated ? 'Sign in to sync with PIMS' : ''}
                            class="px-4 py-2 text-xs font-semibold {isPushing ? 'bg-blue-800' : !$isAuthenticated ? 'bg-gray-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'} rounded-xl transition-all shadow-lg disabled:opacity-50"
                        >
                            {#if !$isAuthenticated}
                                🔒 Sync to PIMS
                            {:else}
                                {isPushing ? "Syncing..." : "Sync to PIMS"}
                            {/if}
                        </button>
                    </div>
                </div>
                <div class="grid md:grid-cols-3 gap-8 flex-grow">
                    <div class="space-y-6">
                        <div class="bg-black/20 rounded-2xl p-6 border border-white/5">
                            <p class="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-4">Consultation Progress</p>
                            <div class="grid grid-cols-2 gap-4">
                                <div class="text-center">
                                    <span class="block text-2xl font-bold font-mono text-white">{formatTime(elapsedTime)}</span>
                                    <span class="text-[10px] text-white/40 uppercase tracking-widest">Elapsed</span>
                                </div>
                                <div class="text-center">
                                    <span class="block text-2xl font-bold font-mono text-blue-400">{$player.totalConsultations}</span>
                                    <span class="text-[10px] text-white/40 uppercase tracking-widest">Sessions</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <p class="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-4">Clinical Templates</p>
                            <div class="grid grid-cols-1 gap-2">
                                {#each Object.entries(SOAP_TEMPLATES).filter(([k]) => visibleTemplates.includes(k)) as [key, template]}
                                    <button on:click={() => (selectedTemplate = key)} class="text-left px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all {selectedTemplate === key ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}">
                                        {template.name}
                                    </button>
                                {/each}
                                {#if !$isPro}
                                    <div class="mt-2 p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                                        <p class="text-[9px] text-blue-400/60 leading-relaxed italic">More templates (Equine, Pathology, etc.) available in Pro tier.</p>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    </div>

                    <div class="md:col-span-2 flex flex-col space-y-4">
                        <div id="soap-stream-box" class="bg-gray-50 text-gray-900 rounded-2xl p-8 min-h-[300px] overflow-y-auto shadow-inner">
                            {#if transcript}
                                <div class="prose prose-sm max-w-none whitespace-pre-wrap font-sans leading-relaxed">{transcript}</div>
                            {:else if isProcessing}
                                <div class="flex flex-col items-center justify-center h-full space-y-4 opacity-40">
                                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    <p class="text-xs">Generating Clinical Record...</p>
                                </div>
                            {:else}
                                <div class="flex flex-col items-center justify-center h-full opacity-20 text-center">
                                    <svg class="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                                    <p class="text-sm">Start recording to generate note</p>
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid md:grid-cols-2 gap-8">
                <div class="glass-panel rounded-3xl p-8 flex items-center justify-between">
                    <div class="flex items-center gap-6">
                        <button on:click={toggleRecording} class="w-16 h-16 rounded-full flex items-center justify-center transition-all {isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20'}">
                            {#if isRecording}
                                <div class="w-5 h-5 bg-white rounded-sm"></div>
                            {:else}
                                <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8h-2a5 5 0 01-10 0H3a7.001 7.001 0 006 6.93V17H6v2h8v-2h-3v-2.07z"/></svg>
                            {/if}
                        </button>
                        <div>
                            <h4 class="font-bold text-white">{isRecording ? "Recording..." : "New Consult"}</h4>
                            <p class="text-xs text-white/40">{isRecording ? "Transcribing live feed" : "Tap icon to start"}</p>
                        </div>
                    </div>
                </div>

                <div class="glass-panel rounded-3xl p-6 bg-black/40">
                    <p class="text-[10px] font-black text-white/20 uppercase tracking-widest mb-4">Live Transcript Buffer</p>
                    <div class="h-[80px] overflow-y-auto font-mono text-[11px] leading-relaxed text-blue-400/60">
                        {rawTranscript || "Awaiting signal..."}
                        {#if interimTranscript}
                            <span class="opacity-30">{interimTranscript}</span>
                        {/if}
                    </div>
                </div>
            </div>

            <div class="glass-panel rounded-3xl overflow-hidden flex flex-col min-h-[400px]">
                <div class="bg-white/5 px-8 py-4 flex justify-between items-center border-b border-white/5">
                    <span class="text-xs font-bold text-white/40 uppercase tracking-widest">Manual Clinical Editor</span>
                    <button on:click={clearWorkspace} class="text-[10px] font-bold text-white/20 hover:text-white/60 transition-colors">CLEAR ALL</button>
                </div>
                <div class="flex h-full">
                    <textarea bind:value={rawTranscript} on:input={handleEditorInput} class="flex-grow bg-transparent p-10 font-mono text-sm leading-relaxed text-white/80 focus:outline-none resize-none" placeholder="Draft clinical notes here..."></textarea>
                    <div class="w-64 border-l border-white/5 p-4 bg-black/20 hidden lg:block">
                        <ReferenceSidebar transcript={transcript || rawTranscript} />
                    </div>
                </div>
            </div>
        </section>
    </main>

    <footer class="mt-20 mb-12 text-center">
        <p class="text-white/10 text-[10px] uppercase tracking-widest font-bold">VetNotes Web &copy; 2026 • Built for Clinicians</p>
    </footer>

    <AxisPickerModal type={activeAxisType || "pathology"} isOpen={showAxisPicker} on:save={handleAxisSave} on:cancel={() => { showAxisPicker = false; activeAxisType = null; }} />
</div>

<style>
    .glass-panel {
        background: rgba(255, 255, 255, 0.02);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.05);
    }
    textarea::-webkit-scrollbar { width: 6px; }
    textarea::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
</style>
