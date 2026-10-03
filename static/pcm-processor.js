class PCMProcessor extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (!input || input.length === 0) return true;

        const channelData = input[0];
        
        // Convert Float32 (-1.0 to 1.0) to Int16 (-32768 to 32767)
        const int16Buffer = new Int16Array(channelData.length);
        for (let i = 0; i < channelData.length; i++) {
            let s = Math.max(-1, Math.min(1, channelData[i]));
            int16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Post the Int16Array to the main thread
        this.port.postMessage(int16Buffer);

        return true;
    }
}

registerProcessor('pcm-processor', PCMProcessor);
