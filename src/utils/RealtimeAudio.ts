import { supabase } from "@/integrations/supabase/client";

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private onAudioData: (audioData: Float32Array) => void) {}

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000, // OpenAI expects 24kHz
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      this.audioContext = new AudioContext({
        sampleRate: 24000, // OpenAI standard sample rate
      });
      
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        this.onAudioData(new Float32Array(inputData));
      };
      
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  stop() {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export class RealtimeChat {
  private ws: WebSocket | null = null;
  private audioEl: HTMLAudioElement;
  private recorder: AudioRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private sequenceNumber = 0;

  constructor(private onMessage: (message: any) => void) {
    this.audioEl = document.createElement("audio");
    this.audioEl.autoplay = true;
  }

  async init(agentId?: string) {
    try {
      // Get ephemeral token from Supabase edge function
      const { data: tokenData, error } = await supabase.functions.invoke('openai-realtime-token', {
        body: { agentId }
      });

      if (error || !tokenData?.client_secret?.value) {
        throw new Error('Failed to get OpenAI token: ' + (error?.message || 'No token received'));
      }

      const ephemeralToken = tokenData.client_secret.value;
      console.log("Got ephemeral token, connecting to OpenAI directly");

      // Connect directly to OpenAI WebSocket (use ephemeral token in URL)
      this.ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17&authorization=Bearer%20${encodeURIComponent(ephemeralToken)}`);
      
      this.ws.onopen = () => {
        console.log("Connected to OpenAI Realtime API");
        this.onMessage({ type: 'connection.established' });
        
        // Send session update with correct format for web app
        this.ws?.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: "You are a helpful AI assistant. Respond naturally and conversationally.",
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 1000
            },
            temperature: 0.8,
            max_response_output_tokens: 'inf'
          }
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Received from OpenAI:", data.type);
          
          if (data.type === 'response.audio.delta' && data.delta) {
            console.log("🎵 Received audio delta, length:", data.delta.length);
            this.playAudioFromBase64(data.delta);
          } else if (data.type === 'input_audio_buffer.speech_started') {
            this.onMessage({ type: 'speaking', isSpeaking: true });
          } else if (data.type === 'input_audio_buffer.speech_stopped') {
            this.onMessage({ type: 'speaking', isSpeaking: false });
          } else if (data.type === 'response.audio_transcript.delta') {
            this.onMessage({ type: 'transcript', text: data.delta });
          }
          
          this.onMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.onMessage({ type: 'error', error: 'Connection failed' });
      };

      this.ws.onclose = () => {
        console.log("WebSocket closed");
        this.onMessage({ type: 'connection.closed' });
      };

      // Set up audio context for playback (24kHz for OpenAI)
      this.audioContext = new AudioContext({ sampleRate: 24000 });

      // Start recording
      this.recorder = new AudioRecorder((audioData) => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          // Convert to PCM16 format for OpenAI
          const base64Audio = this.encodeAudioForOpenAI(audioData);
          this.ws.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64Audio
          }));
        }
      });
      await this.recorder.start();

    } catch (error) {
      console.error("Error initializing chat:", error);
      throw error;
    }
  }

  private encodeAudioForOpenAI(float32Array: Float32Array): string {
    // Convert Float32 to 16-bit PCM for OpenAI
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Convert to base64
    const uint8Array = new Uint8Array(int16Array.buffer);
    let binary = '';
    const chunkSize = 0x8000;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  }

  private async playAudioFromBase64(base64Audio: string) {
    try {
      if (!this.audioContext) {
        console.error('No audio context available');
        return;
      }

      // Resume audio context if suspended (browser requirement)
      if (this.audioContext.state === 'suspended') {
        console.log('Resuming audio context...');
        await this.audioContext.resume();
      }
      
      console.log('🎵 Playing audio chunk, base64 length:', base64Audio.length);
      
      // Decode base64 to PCM16 data
      const binaryString = atob(base64Audio);
      const uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }
      
      // Convert bytes to 16-bit samples (little-endian)
      const int16Array = new Int16Array(uint8Array.length / 2);
      for (let i = 0; i < uint8Array.length; i += 2) {
        int16Array[i / 2] = (uint8Array[i + 1] << 8) | uint8Array[i];
      }
      
      // Convert to Float32 for audio buffer
      const floatArray = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        floatArray[i] = int16Array[i] / 32768.0;
      }
      
      // Create audio buffer and play
      const audioBuffer = this.audioContext.createBuffer(1, floatArray.length, 24000);
      audioBuffer.getChannelData(0).set(floatArray);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      source.onended = () => {
        console.log('Audio chunk finished playing');
      };
      
      source.start();
      console.log('Started playing audio chunk');
      
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }

  async sendMessage(text: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not ready');
    }

    // For now, just log text messages - the Railway server handles audio
    console.log('Sending text message:', text);
  }

  disconnect() {
    this.recorder?.stop();
    this.ws?.close();
  }
}