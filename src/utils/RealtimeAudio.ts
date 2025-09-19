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
          sampleRate: 8000, // Match Railway server's g711_ulaw format
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      this.audioContext = new AudioContext({
        sampleRate: 8000, // Match g711_ulaw sample rate
      });
      
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(320, 1, 1); // Smaller chunks for g711
      
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
      // Connect to Railway server WebSocket - replace with your actual Railway URL
      const railwayUrl = 'wss://twilio-openai-voice-server-ultimate-fix-production.up.railway.app';
      this.ws = new WebSocket(`${railwayUrl}/media-stream`);
      
      this.ws.onopen = () => {
        console.log("Connected to Railway server");
        this.onMessage({ type: 'connection.established' });
        
        // Send Twilio-style start message
        this.ws?.send(JSON.stringify({
          event: 'start',
          sequenceNumber: this.sequenceNumber++,
          start: {
            streamSid: 'web-stream-' + Date.now(),
            accountSid: 'web-account',
            callSid: 'web-call-' + Date.now(),
            tracks: ['inbound'],
            mediaFormat: {
              encoding: 'audio/x-mulaw',
              sampleRate: 8000,
              channels: 1
            }
          }
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Received from Railway:", data);
          
          if (data.event === 'media' && data.media?.payload) {
            // Handle audio data from Railway server
            this.playAudioFromBase64(data.media.payload);
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

      // Set up audio context for playback
      this.audioContext = new AudioContext({ sampleRate: 8000 });

      // Start recording
      this.recorder = new AudioRecorder((audioData) => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          // Convert to g711_ulaw format and send to Railway
          const base64Audio = this.encodeAudioForTwilio(audioData);
          this.ws.send(JSON.stringify({
            event: 'media',
            sequenceNumber: this.sequenceNumber++,
            media: {
              timestamp: Date.now().toString(),
              payload: base64Audio
            }
          }));
        }
      });
      await this.recorder.start();

    } catch (error) {
      console.error("Error initializing chat:", error);
      throw error;
    }
  }

  private encodeAudioForTwilio(float32Array: Float32Array): string {
    // Convert Float32 to 16-bit PCM
    const pcmArray = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      pcmArray[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Convert to g711 u-law (simplified - for production use proper codec)
    const ulawArray = new Uint8Array(pcmArray.length);
    for (let i = 0; i < pcmArray.length; i++) {
      ulawArray[i] = this.linearToUlaw(pcmArray[i]);
    }
    
    return btoa(String.fromCharCode.apply(null, Array.from(ulawArray)));
  }

  private linearToUlaw(sample: number): number {
    // Simplified u-law encoding
    const BIAS = 0x84;
    const CLIP = 32635;
    
    sample = sample >> 2;
    if (sample < 0) {
      sample = -sample;
      sample |= 0x8000;
    }
    
    if (sample > CLIP) sample = CLIP;
    sample += BIAS;
    
    let exponent = 7;
    for (let i = 0x4000; i > 0; i >>= 1) {
      if (sample >= i) {
        sample -= i;
        break;
      }
      exponent--;
    }
    
    const mantissa = (sample >> (exponent + 3)) & 0x0F;
    return ~(exponent << 4 | mantissa);
  }

  private async playAudioFromBase64(base64Audio: string) {
    try {
      if (!this.audioContext) return;
      
      // Decode base64 to u-law data
      const binaryString = atob(base64Audio);
      const ulawArray = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        ulawArray[i] = binaryString.charCodeAt(i);
      }
      
      // Convert u-law to linear PCM
      const pcmArray = new Float32Array(ulawArray.length);
      for (let i = 0; i < ulawArray.length; i++) {
        pcmArray[i] = this.ulawToLinear(ulawArray[i]) / 32768.0;
      }
      
      // Create audio buffer and play
      const audioBuffer = this.audioContext.createBuffer(1, pcmArray.length, 8000);
      audioBuffer.getChannelData(0).set(pcmArray);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();
      
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }

  private ulawToLinear(ulawByte: number): number {
    // Simplified u-law decoding
    ulawByte = ~ulawByte;
    const sign = (ulawByte & 0x80) ? -1 : 1;
    const exponent = (ulawByte >> 4) & 0x07;
    const mantissa = ulawByte & 0x0F;
    
    let sample = mantissa << (exponent + 3);
    sample += 0x84;
    sample <<= 2;
    
    return sign * sample;
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