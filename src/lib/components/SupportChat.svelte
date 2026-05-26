<script lang="ts">
    import { onMount } from 'svelte';
    import { sendMessage, speakText, stopSpeaking, type ChatMessage } from '$lib/services/support';

    let isOpen = false;
    let isExpanded = false;
    let messages: ChatMessage[] = [];
    let inputText = '';
    let isLoading = false;

    // Voice input state
    let isListening = false;
    let recognition: any = null;

    // Image attachment state
    let attachedImage: { file: File; preview: string } | null = null;
    let fileInput: HTMLInputElement;

    // TTS state
    let speakingMsgIndex: number | null = null;

    onMount(() => {
        // Add welcome message — NO API key check, chat always works
        messages = [{
            role: 'model',
            text: "Hi! I'm VetNotes Support. I can help with recording issues, SOAP structuring, API key setup, templates, and more. How can I help?",
            timestamp: Date.now()
        }];

        // Init Web Speech API for voice input
        if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onresult = (event: any) => {
                // Accumulate all final results into the input field
                let transcript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        transcript += event.results[i][0].transcript;
                    }
                }
                if (transcript) {
                    inputText = inputText ? `${inputText} ${transcript}` : transcript;
                }
            };

            recognition.onerror = () => {
                isListening = false;
            };

            recognition.onend = () => {
                isListening = false;
            };
        }
    });

    function toggleVoice() {
        if (!recognition) {
            alert('Voice input requires Chrome or Edge browser.');
            return;
        }
        if (isListening) {
            recognition.stop();
            isListening = false;
        } else {
            recognition.start();
            isListening = true;
        }
    }

    function handleImageClick() {
        fileInput?.click();
    }

    function handleImageSelect(e: Event) {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }
        const preview = URL.createObjectURL(file);
        attachedImage = { file, preview };
    }

    function removeImage() {
        if (attachedImage) {
            URL.revokeObjectURL(attachedImage.preview);
            attachedImage = null;
        }
    }

    function speakMessage(text: string, index: number) {
        if (speakingMsgIndex === index) {
            stopSpeaking();
            speakingMsgIndex = null;
            return;
        }
        stopSpeaking();
        speakingMsgIndex = index;
        speakText(text);
        // Reset after approximate duration
        setTimeout(() => { speakingMsgIndex = null; }, 10000);
    }

    async function handleSend() {
        if ((!inputText.trim() && !attachedImage) || isLoading) return;

        let userText = inputText.trim();
        const image = attachedImage;

        // Build display text
        let displayText = userText;
        if (image && !userText) {
            displayText = '📷 [Image attached]';
        } else if (image) {
            displayText = `📷 ${userText}`;
        }

        const userMsg: ChatMessage = {
            role: 'user',
            text: displayText,
            timestamp: Date.now()
        };
        messages = [...messages, userMsg];

        // If image attached, add context to the query
        let imageBase64: string | undefined;
        if (image) {
            userText = userText
                ? `[User attached an image: ${image.file.name}] ${userText}`
                : `[User attached an image: ${image.file.name}] Please describe what you see or how I can help with this.`;
            // Convert to base64 for the service
            try {
                const reader = new FileReader();
                imageBase64 = await new Promise<string>((resolve) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(image.file);
                });
            } catch {
                // If conversion fails, just send text
            }
        }

        inputText = '';
        removeImage();
        isLoading = true;

        try {
            const response = await sendMessage(userText, imageBase64);
            messages = [...messages, {
                role: 'model',
                text: response,
                timestamp: Date.now()
            }];
        } catch (e: any) {
            messages = [...messages, {
                role: 'model',
                text: `⚠️ Connection error: ${e.message || 'Unable to reach support service'}. Please try again or email support@vetsorcery.com.`,
                timestamp: Date.now()
            }];
        } finally {
            isLoading = false;
        }

        // Scroll to bottom
        setTimeout(() => {
            const container = document.getElementById('support-chat-messages');
            if (container) container.scrollTop = container.scrollHeight;
        }, 50);
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }
</script>

<!-- Hidden file input for image attachment -->
<input
    bind:this={fileInput}
    type="file"
    accept="image/*"
    class="hidden"
    on:change={handleImageSelect}
/>

<!-- Floating Chat Bubble -->
{#if !isOpen}
    <button
        on:click={() => isOpen = true}
        class="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-500 rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center transition-all z-50 hover:scale-110"
        aria-label="Open support chat"
    >
        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
        </svg>
    </button>
{/if}

<!-- Chat Panel -->
{#if isOpen}
    <div
        class="fixed z-50 flex flex-col overflow-hidden bg-gray-900 border border-white/10 rounded-2xl shadow-2xl transition-all duration-200"
        class:bottom-6={!isExpanded}
        class:right-6={!isExpanded}
        class:w-[360px]={!isExpanded}
        class:h-[500px]={!isExpanded}
        class:inset-4={isExpanded}
        class:w-auto={isExpanded}
        class:h-auto={isExpanded}
    >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 bg-blue-600/20 border-b border-white/10">
            <div class="flex items-center space-x-2">
                <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span class="text-white text-xs font-bold">VN</span>
                </div>
                <div>
                    <p class="text-sm font-bold text-white flex items-center gap-2">
                        <span class="w-2 h-2 bg-green-400 rounded-full"></span>
                        VetNotes Support
                    </p>
                    <p class="text-[10px] text-white/40">AI-powered help</p>
                </div>
            </div>
            <div class="flex items-center space-x-1">
                <!-- Expand/Collapse -->
                <button
                    on:click={() => isExpanded = !isExpanded}
                    class="text-white/40 hover:text-white transition-colors p-1"
                    aria-label={isExpanded ? 'Minimize chat' : 'Expand chat'}
                >
                    {#if isExpanded}
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9L4 4m0 0v4m0-4h4m6 6l5 5m0 0v-4m0 4h-4"/>
                        </svg>
                    {:else}
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 3h6m0 0v6m0-6l-7 7M9 21H3m0 0v-6m0 6l7-7"/>
                        </svg>
                    {/if}
                </button>
                <!-- Close -->
                <button on:click={() => isOpen = false} class="text-white/40 hover:text-white transition-colors p-1" aria-label="Close chat">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        </div>

        <!-- Messages -->
        <div id="support-chat-messages" class="flex-1 overflow-y-auto p-4 space-y-3">
            {#each messages as msg, i}
                <div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
                    <div class="max-w-[80%]">
                        <div class="px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-line {msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/80 border border-white/10'}">
                            {#if msg.role === 'model'}
                                <p class="text-[10px] text-blue-400 font-medium mb-1">VetNotes AI</p>
                            {/if}
                            {msg.text}
                        </div>
                        <!-- Listen button for AI messages -->
                        {#if msg.role === 'model' && i > 0}
                            <button
                                on:click={() => speakMessage(msg.text, i)}
                                class="mt-1 text-[11px] text-white/30 hover:text-blue-400 transition-colors flex items-center gap-1"
                                aria-label={speakingMsgIndex === i ? 'Stop speaking' : 'Listen to message'}
                            >
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M11 5L6 9H2v6h4l5 4V5z"/>
                                </svg>
                                {speakingMsgIndex === i ? 'Stop' : 'Listen'}
                            </button>
                        {/if}
                    </div>
                </div>
            {/each}
            {#if isLoading}
                <div class="flex justify-start">
                    <div class="bg-white/5 border border-white/10 px-3 py-2 rounded-xl">
                        <div class="flex space-x-1">
                            <div class="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                            <div class="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                            <div class="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                        </div>
                    </div>
                </div>
            {/if}
        </div>

        <!-- Image Preview -->
        {#if attachedImage}
            <div class="px-3 pt-2 border-t border-white/10">
                <div class="relative inline-block">
                    <img src={attachedImage.preview} alt="Attached" class="h-16 rounded-lg border border-white/10" />
                    <button
                        on:click={removeImage}
                        class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px]"
                        aria-label="Remove image"
                    >×</button>
                </div>
            </div>
        {/if}

        <!-- Input -->
        <div class="p-3 border-t border-white/10">
            <div class="flex items-center space-x-2">
                <!-- Image attachment button -->
                <button
                    on:click={handleImageClick}
                    class="w-8 h-8 flex items-center justify-center text-white/30 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                    aria-label="Attach image"
                    title="Attach image"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                        <circle cx="12" cy="13" r="3"/>
                    </svg>
                </button>

                <!-- Voice input button -->
                <button
                    on:click={toggleVoice}
                    class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors {isListening ? 'text-red-400 bg-red-400/10 animate-pulse' : 'text-white/30 hover:text-white hover:bg-white/5'}"
                    aria-label={isListening ? 'Stop listening' : 'Voice input'}
                    title={isListening ? 'Stop listening' : 'Voice input'}
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                    </svg>
                </button>

                <!-- Text input -->
                <input
                    type="text"
                    bind:value={inputText}
                    on:keydown={handleKeydown}
                    placeholder={isListening ? 'Listening...' : 'Ask about VetNotes...'}
                    class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500"
                />

                <!-- Send button -->
                <button
                    on:click={handleSend}
                    disabled={(!inputText.trim() && !attachedImage) || isLoading}
                    class="w-9 h-9 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 rounded-xl flex items-center justify-center transition-colors"
                    aria-label="Send message"
                >
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                    </svg>
                </button>
            </div>
        </div>
    </div>
{/if}
