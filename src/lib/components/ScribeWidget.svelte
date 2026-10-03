<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { auth } from '$lib/firebase';

  export let clinicId: string;
  export let patientId: string;

  let isRecording = false;
  let statusText = "Ready to Scribe";
  let audioContext: AudioContext | null = null;
  let mediaStream: MediaStream | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let socket: WebSocket | null = null;

  async function startRecording() {
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      if (!token) {
        statusText = "Authentication required";
        return;
      }

      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      socket = new WebSocket(import.meta.env.VITE_WS_URL || "ws://localhost:8080/api/live/stream");
      
      socket.onopen = async () => {
        statusText = "Recording & Streaming (16kHz PCM)...";
        isRecording = true;
        
        // Send Auth Token first for security validation
        socket?.send(JSON.stringify({ type: "auth", token }));
        
        // Setup AudioContext locked to 16kHz for Gemini
        audioContext = new AudioContext({ sampleRate: 16000 });
        await audioContext.audioWorklet.addModule('/pcm-processor.js');
        
        const source = audioContext.createMediaStreamSource(mediaStream);
        workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
        
        workletNode.port.onmessage = (event) => {
          if (socket?.readyState === WebSocket.OPEN) {
            const int16Buffer = event.data; // Int16Array
            
            // Base64 encode the raw bytes
            const uint8Array = new Uint8Array(int16Buffer.buffer);
            let binary = '';
            for (let i = 0; i < uint8Array.byteLength; i++) {
                binary += String.fromCharCode(uint8Array[i]);
            }
            const base64String = btoa(binary);
            
            const payload = {
              realtimeInput: {
                mediaChunks: [{
                  mimeType: "audio/pcm;rate=16000",
                  data: base64String
                }]
              }
            };
            socket.send(JSON.stringify(payload));
          }
        };
        
        source.connect(workletNode);
        workletNode.connect(audioContext.destination);
      };

      socket.onmessage = (event) => {
        // Handle incoming JSON from Gemini (transcripts/notes)
        console.log("Received from Gemini:", event.data);
      };

      socket.onclose = () => {
        stopRecording();
      };
      
    } catch (err) {
      console.error("Failed to access microphone or connect:", err);
      statusText = "Microphone Error";
    }
  }

  function stopRecording() {
    if (workletNode) workletNode.disconnect();
    if (audioContext && audioContext.state !== 'closed') audioContext.close();
    if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
    if (socket) socket.close();
    
    isRecording = false;
    statusText = "Stopped. Processing note...";
  }

  onDestroy(() => {
    stopRecording();
  });
</script>

<div class="fixed bottom-8 right-8 z-50">
  <div class="bg-white rounded-2xl shadow-2xl p-4 border border-blue-100 flex items-center space-x-4">
    <div class="flex-1">
      <h4 class="text-sm font-bold text-gray-900">AIVA Scribe</h4>
      <p class="text-xs text-gray-500">{statusText}</p>
    </div>
    
    <button
      class="w-12 h-12 rounded-full flex items-center justify-center transition-colors {isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'}"
      on:click={isRecording ? stopRecording : startRecording}
    >
      {#if isRecording}
        <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
          <rect x="5" y="5" width="10" height="10" />
        </svg>
      {:else}
        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      {/if}
    </button>
  </div>
</div>
