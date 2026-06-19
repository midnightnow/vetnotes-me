<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { sendMessage, speakText, stopSpeaking, type ChatMessage } from '$lib/services/support';

    let isOpen = $state(false);
    let isExpanded = $state(false);
    let messages = $state<ChatMessage[]>([]);
    let inputText = $state('');
    let isLoading = $state(false);

    // Voice input state
    let isListening = $state(false);
    let recognition: any = null;
    let voiceIdleCountdown = $state<number | null>(null);

    // Voice checkpoint pattern — prevents transcript accumulation across sends.
    // lastSentLength: raw cumulative final transcript length at last send.
    // rawFinalLength: running total of finalized speech in this session.
    let lastSentLength = 0;
    let rawFinalLength = 0;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let countdownTimer: ReturnType<typeof setTimeout> | null = null;
    let countdownInterval: ReturnType<typeof setInterval> | null = null;

    // Global drag-and-drop state
    let isDraggingFile = $state(false);

    // Image attachment state
    let attachedImage = $state<{ file: File; preview: string } | null>(null);
    let fileInput: HTMLInputElement | undefined = $state();
    let messagesEl: HTMLDivElement | undefined = $state();

    // TTS state
    let speakingMsgIndex = $state<number | null>(null);

    onMount(() => {
        messages = [{
            role: 'model',
            text: "Hi! I'm VetNotes Support. I can help with recording issues, SOAP structuring, API key setup, templates, and more. How can I help?",
            timestamp: Date.now()
        }];
    });

    onDestroy(() => {
        clearVoiceIdleTimers();
        if (recognition) { recognition.stop(); recognition = null; }
    });

    // ─── Voice idle timer ────────────────────────────────────────────────────

    function clearVoiceIdleTimers() {
        if (idleTimer) clearTimeout(idleTimer);
        if (countdownTimer) clearTimeout(countdownTimer);
        if (countdownInterval) clearInterval(countdownInterval);
        idleTimer = null; countdownTimer = null; countdownInterval = null;
        voiceIdleCountdown = null;
    }

    function resetVoiceIdleTimer() {
        if (!isListening) return;
        clearVoiceIdleTimers();
        // Show countdown at 10s, auto-stop at 15s
        countdownTimer = setTimeout(() => {
            voiceIdleCountdown = 5;
            countdownInterval = setInterval(() => {
                if (voiceIdleCountdown !== null && voiceIdleCountdown > 1) {
                    voiceIdleCountdown -= 1;
                } else {
                    clearVoiceIdleTimers();
                }
            }, 1000);
        }, 10_000);
        idleTimer = setTimeout(() => { stopVoice(); }, 15_000);
    }

    function stopVoice() {
        clearVoiceIdleTimers();
        if (recognition) { recognition.stop(); }
        recognition = null;
        isListening = false;
        lastSentLength = 0;
        rawFinalLength = 0;
    }

    function toggleVoice() {
        if (isListening) { stopVoice(); return; }

        if (typeof window === 'undefined') return;
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        if (!SpeechRecognition) {
            alert('Voice input requires Chrome or Edge browser.');
            return;
        }

        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-AU';

        // Fresh session — reset all checkpoints
        lastSentLength = 0;
        rawFinalLength = 0;
        inputText = '';

        rec.onresult = (event: any) => {
            resetVoiceIdleTimer();

            // Build the full cumulative transcript from all results in this session.
            // Web Speech fires a monotonically growing SpeechRecognitionResultList.
            let fullFinal = '';
            let interimTail = '';
            for (let i = 0; i < event.results.length; i++) {
                const text = event.results[i][0].transcript;
                if (event.results[i].isFinal) { fullFinal += text; }
                else { interimTail += text; }
            }

            rawFinalLength = fullFinal.length;

            // Slice from the last-sent checkpoint to show only NEW speech.
            // handleSend() advances lastSentLength on each send.
            const newFinal = fullFinal.length > lastSentLength
                ? fullFinal.slice(lastSentLength).trim()
                : '';

            inputText = interimTail.trim()
                ? `${newFinal} ${interimTail.trim()}`.trim()
                : newFinal;
        };

        rec.onend = () => {
            if (recognition !== rec) return;
            recognition = null;
            isListening = false;
            clearVoiceIdleTimers();
            lastSentLength = 0;
            rawFinalLength = 0;
        };

        rec.onerror = (e: any) => {
            if (e.error === 'not-allowed') alert('Microphone access denied.');
            if (recognition === rec) recognition = null;
            isListening = false;
            clearVoiceIdleTimers();
        };

        recognition = rec;
        rec.start();
        isListening = true;
        resetVoiceIdleTimer();
    }

    // ─── Image handling ──────────────────────────────────────────────────────

    function handleImageClick() { fileInput?.click(); }

    function handleImageSelect(e: Event) {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
        const preview = URL.createObjectURL(file);
        attachedImage = { file, preview };
    }

    function removeImage() {
        if (attachedImage) { URL.revokeObjectURL(attachedImage.preview); attachedImage = null; }
    }

    // ─── Global drag-and-drop ────────────────────────────────────────────────

    function handleWindowDragOver(e: DragEvent) {
        e.preventDefault();
        isDraggingFile = true;
    }

    function handleWindowDragLeave(e: DragEvent) {
        // Only clear when leaving the window entirely
        if (e.clientX === 0 && e.clientY === 0) isDraggingFile = false;
    }

    function handleWindowDrop(e: DragEvent) {
        e.preventDefault();
        isDraggingFile = false;
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        if (file.type.startsWith('image/')) {
            const preview = URL.createObjectURL(file);
            attachedImage = { file, preview };
        }
    }

    // ─── TTS ─────────────────────────────────────────────────────────────────

    function speakMessage(text: string, index: number) {
        if (speakingMsgIndex === index) { stopSpeaking(); speakingMsgIndex = null; return; }
        stopSpeaking();
        speakingMsgIndex = index;
        speakText(text);
        setTimeout(() => { speakingMsgIndex = null; }, 10000);
    }

    // ─── Send ────────────────────────────────────────────────────────────────

    async function handleSend() {
        if ((!inputText.trim() && !attachedImage) || isLoading) return;

        // Snapshot before clearing
        const userText = inputText.trim();
        const image = attachedImage;

        // Clear input atomically — advance voice checkpoint so new speech
        // starts fresh without repeating the sent fragment
        inputText = '';
        removeImage();
        if (isListening) {
            // Advance the checkpoint to the current raw cumulative final length.
            // onresult will slice from here, showing only speech after this send.
            lastSentLength = rawFinalLength;
            resetVoiceIdleTimer();
        }

        // Build display text
        let displayText = userText;
        if (image && !userText) displayText = '📷 [Image attached]';
        else if (image) displayText = `📷 ${userText}`;

        messages = [...messages, { role: 'user', text: displayText, timestamp: Date.now() }];
        isLoading = true;

        // Build query text (append image context if present)
        let queryText = userText;
        let imageBase64: string | undefined;
        if (image) {
            queryText = userText
                ? `[User attached an image: ${image.file.name}] ${userText}`
                : `[User attached an image: ${image.file.name}] Please describe what you see or how I can help.`;
            try {
                const reader = new FileReader();
                imageBase64 = await new Promise<string>((resolve) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(image.file);
                });
            } catch { /* send text only if read fails */ }
        }

        try {
            const response = await sendMessage(queryText, imageBase64);
            messages = [...messages, { role: 'model', text: response, timestamp: Date.now() }];
        } catch (e: any) {
            messages = [...messages, {
                role: 'model',
                text: `⚠️ ${e.message || 'Unable to reach support service'}. Please try again or email support@vetsorcery.com.`,
                timestamp: Date.now()
            }];
        } finally {
            isLoading = false;
        }

        setTimeout(() => {
            if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
        }, 50);
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    }
</script>

<!-- Global drag-and-drop overlay — covers full viewport -->
<svelte:window
    ondragover={handleWindowDragOver}
    ondragleave={handleWindowDragLeave}
    ondrop={handleWindowDrop}
/>

{#if isDraggingFile}
    <div class="fixed inset-0 bg-slate-950/70 border-4 border-dashed border-blue-500 z-[9998] flex items-center justify-center backdrop-blur-sm pointer-events-none">
        <div class="text-center">
            <span class="text-5xl block mb-3 animate-bounce">📎</span>
            <p class="text-white font-bold text-lg">Drop image to share with AIVA</p>
        </div>
    </div>
{/if}

<!-- Hidden file input -->
<input bind:this={fileInput} type="file" accept="image/*" class="hidden" onchange={handleImageSelect} />

<!-- FAB — shown when chat is closed -->
{#if !isOpen}
    <button
        onclick={() => isOpen = true}
        class="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:scale-105 rounded-full shadow-lg shadow-blue-500/40 flex items-center justify-center transition-all duration-200 z-50 group"
        aria-label="Open AIVA support"
    >
        <span class="absolute inset-0 rounded-full border border-white/10 group-hover:rotate-180 transition-transform duration-[2000ms]"></span>
        <svg class="w-6 h-6 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
        </svg>
    </button>
{/if}

<!-- Chat panel -->
{#if isOpen}
    <div
        class="fixed z-50 flex flex-col overflow-hidden bg-gray-900 border border-white/10 rounded-2xl shadow-2xl transition-all duration-200
               {isExpanded ? 'inset-4' : 'bottom-6 right-6 w-[360px] h-[520px]'}"
    >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 bg-blue-600/20 border-b border-white/10 shrink-0">
            <div class="flex items-center gap-2">
                <div class="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                    <span class="text-white text-xs font-bold">VN</span>
                </div>
                <div>
                    <p class="text-sm font-bold text-white flex items-center gap-1.5">
                        <span class="w-2 h-2 bg-green-400 rounded-full {isListening ? 'animate-pulse bg-red-400' : ''}"></span>
                        VetNotes AI
                    </p>
                    <p class="text-[10px] text-white/40">
                        {#if isListening && voiceIdleCountdown !== null}
                            Stopping in {voiceIdleCountdown}s…
                        {:else if isListening}
                            Listening…
                        {:else}
                            AI-powered help
                        {/if}
                    </p>
                </div>
            </div>
            <div class="flex items-center gap-1">
                <button
                    onclick={() => isExpanded = !isExpanded}
                    class="text-white/40 hover:text-white transition-colors p-1 rounded"
                    aria-label={isExpanded ? 'Minimize' : 'Expand'}
                >
                    {#if isExpanded}
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9L4 4m0 0v4m0-4h4m6 6l5 5m0 0v-4m0 4h-4"/></svg>
                    {:else}
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 3h6m0 0v6m0-6l-7 7M9 21H3m0 0v-6m0 6l7-7"/></svg>
                    {/if}
                </button>
                <button onclick={() => isOpen = false} class="text-white/40 hover:text-white transition-colors p-1 rounded" aria-label="Close">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
        </div>

        <!-- Messages -->
        <div bind:this={messagesEl} class="flex-1 overflow-y-auto p-4 space-y-3">
            {#each messages as msg, i}
                <div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
                    <div class="max-w-[85%]">
                        <div class="px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-line {msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/80 border border-white/10'}">
                            {#if msg.role === 'model'}
                                <p class="text-[10px] text-blue-400 font-semibold mb-1">VetNotes AI</p>
                            {/if}
                            {msg.text}
                        </div>
                        {#if msg.role === 'model' && i > 0}
                            <button
                                onclick={() => speakMessage(msg.text, i)}
                                class="mt-1 text-[11px] text-white/30 hover:text-blue-400 transition-colors flex items-center gap-1"
                                aria-label={speakingMsgIndex === i ? 'Stop' : 'Listen'}
                            >
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M11 5L6 9H2v6h4l5 4V5z"/></svg>
                                {speakingMsgIndex === i ? 'Stop' : 'Listen'}
                            </button>
                        {/if}
                    </div>
                </div>
            {/each}
            {#if isLoading}
                <div class="flex justify-start">
                    <div class="bg-white/5 border border-white/10 px-3 py-2.5 rounded-xl flex gap-1">
                        <div class="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style="animation-delay:0ms"></div>
                        <div class="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style="animation-delay:150ms"></div>
                        <div class="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style="animation-delay:300ms"></div>
                    </div>
                </div>
            {/if}
        </div>

        <!-- Image preview strip -->
        {#if attachedImage}
            <div class="px-3 pt-2 border-t border-white/10 shrink-0">
                <div class="relative inline-block">
                    <img src={attachedImage.preview} alt="Attached" class="h-16 rounded-lg border border-white/10 object-cover" />
                    <button onclick={removeImage} class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold" aria-label="Remove image">×</button>
                </div>
            </div>
        {/if}

        <!-- Input bar -->
        <div class="p-3 border-t border-white/10 shrink-0">
            <div class="flex items-center gap-2">

                <!-- Attach image -->
                <button onclick={handleImageClick} class="w-8 h-8 flex items-center justify-center text-white/30 hover:text-white transition-colors rounded-lg hover:bg-white/5 shrink-0" aria-label="Attach image">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg>
                </button>

                <!-- Voice button — red ring + countdown when active -->
                <button
                    onclick={toggleVoice}
                    class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 relative {isListening ? 'text-red-400 bg-red-400/10' : 'text-white/30 hover:text-white hover:bg-white/5'}"
                    aria-label={isListening ? 'Stop recording' : 'Voice input'}
                    title={isListening ? 'Stop recording' : 'Voice input'}
                >
                    {#if isListening}
                        <!-- Pulsing outer ring -->
                        <span class="absolute inset-0 rounded-lg border-2 border-red-500 animate-ping opacity-60"></span>
                    {/if}
                    <svg class="w-4 h-4 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                    {#if voiceIdleCountdown !== null}
                        <span class="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-600 rounded-full text-[9px] text-white flex items-center justify-center font-bold leading-none">{voiceIdleCountdown}</span>
                    {/if}
                </button>

                <!-- Text input -->
                <input
                    type="text"
                    bind:value={inputText}
                    onkeydown={handleKeydown}
                    placeholder={isListening ? 'Listening…' : 'Ask about VetNotes…'}
                    class="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500 transition-colors"
                />

                <!-- Send -->
                <button
                    onclick={handleSend}
                    disabled={(!inputText.trim() && !attachedImage) || isLoading}
                    class="w-9 h-9 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl flex items-center justify-center transition-colors shrink-0"
                    aria-label="Send"
                >
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                </button>
            </div>
        </div>
    </div>
{/if}
