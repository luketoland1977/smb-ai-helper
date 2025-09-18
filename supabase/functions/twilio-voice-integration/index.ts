import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Audio conversion utilities
function mulawToPcm16(mulawData: Uint8Array): Uint8Array {
  const pcm16Data = new Int16Array(mulawData.length);
  for (let i = 0; i < mulawData.length; i++) {
    const mulaw = mulawData[i];
    const sign = (mulaw & 0x80) ? -1 : 1;
    const exponent = (mulaw >> 4) & 0x07;
    const mantissa = mulaw & 0x0F;
    const sample = sign * ((1 << (exponent + 7)) + (mantissa << (exponent + 3)));
    pcm16Data[i] = Math.max(-32768, Math.min(32767, sample));
  }
  return new Uint8Array(pcm16Data.buffer);
}

function pcm16ToMulaw(pcm16Data: Uint8Array): Uint8Array {
  const samples = new Int16Array(pcm16Data.buffer);
  const mulawData = new Uint8Array(samples.length);
  
  for (let i = 0; i < samples.length; i++) {
    let sample = samples[i];
    const sign = (sample < 0) ? 0x80 : 0x00;
    if (sample < 0) sample = -sample;
    
    if (sample > 32635) sample = 32635;
    sample = sample + 132;
    
    let exponent = 7;
    for (let exp = 0; exp < 8; exp++) {
      if (sample <= (0x1F << (exp + 3))) {
        exponent = exp;
        break;
      }
    }
    
    const mantissa = (sample >> (exponent + 3)) & 0x0F;
    mulawData[i] = ~(sign | (exponent << 4) | mantissa);
  }
  
  return mulawData;
}

function encodeAudioToBase64(pcm16Data: Uint8Array): string {
  const binary = String.fromCharCode(...pcm16Data);
  return btoa(binary);
}

function decodeAudioFromBase64(base64Audio: string): Uint8Array {
  const binary = atob(base64Audio);
  return new Uint8Array(binary.split('').map(char => char.charCodeAt(0)));
}

function resampleAudio(inputData: Uint8Array, inputSampleRate: number, outputSampleRate: number): Uint8Array {
  if (inputSampleRate === outputSampleRate) return inputData;
  
  const samples = new Int16Array(inputData.buffer);
  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.floor(samples.length / ratio);
  const outputSamples = new Int16Array(outputLength);
  
  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = Math.floor(i * ratio);
    outputSamples[i] = samples[Math.min(sourceIndex, samples.length - 1)];
  }
  
  return new Uint8Array(outputSamples.buffer);
}

serve(async (req) => {
  const url = new URL(req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Handle incoming call webhook - return TwiML
  if (url.pathname === '/incoming-call') {
    console.log('Incoming call webhook received');
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${url.host}/functions/v1/twilio-voice-integration" />
  </Connect>
</Response>`;
    
    return new Response(twiml, {
      headers: { 
        ...corsHeaders,
        "Content-Type": "text/xml" 
      },
    });
  }
  
  // Handle WebSocket upgrade for media stream
  const upgrade = req.headers.get("upgrade");
  if (upgrade === "websocket") {
    console.log('WebSocket upgrade request received');
    
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    let openAISocket: WebSocket | null = null;
    let sessionReady = false;
    let audioBuffer: string[] = [];
    let connectionAttempts = 0;
    let heartbeatInterval: number | null = null;
    let reconnectTimeout: number | null = null;
    const maxAttempts = 3;
    const heartbeatIntervalMs = 30000; // 30 seconds
    
    // Get call details from URL parameters
    const callSid = url.searchParams.get('callSid') || 'unknown';
    const from = url.searchParams.get('from') || 'unknown';
    const to = url.searchParams.get('to') || 'unknown';
    
    console.log(`Call details - SID: ${callSid}, From: ${from}, To: ${to}`);
    
    // Fetch agent configuration from database
    let agentConfig: any = null;
    try {
      const { data: twilioIntegration } = await supabase
        .from('twilio_integrations')
        .select(`
          *,
          ai_agents (
            name,
            system_prompt,
            settings
          )
        `)
        .eq('phone_number', to)
        .eq('is_active', true)
        .single();
      
      if (twilioIntegration) {
        agentConfig = twilioIntegration;
        console.log('Found agent configuration:', agentConfig.ai_agents?.name);
      } else {
        console.log('No agent configuration found for phone number:', to);
      }
    } catch (error) {
      console.error('Error fetching agent config:', error);
    }
    
    // Cleanup function
    const cleanup = () => {
      console.log('Cleaning up connections');
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
        openAISocket.close();
      }
    };
    
    // OpenAI connection function with retry logic
    const connectToOpenAI = async (): Promise<void> => {
      if (openAISocket && (openAISocket.readyState === WebSocket.OPEN || openAISocket.readyState === WebSocket.CONNECTING)) {
        return;
      }
      
      if (connectionAttempts >= maxAttempts) {
        console.error(`Max connection attempts (${maxAttempts}) to OpenAI reached. Closing Twilio connection.`);
        cleanup();
        socket.close();
        return;
      }

      connectionAttempts++;
      console.log(`Connecting to OpenAI (attempt ${connectionAttempts}/${maxAttempts})...`);
      
      try {
        // Get OpenAI ephemeral token
        const tokenResponse = await fetch("https://api.openai.com/v1/realtime/sessions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-realtime-preview-2024-12-17",
            voice: agentConfig?.voice_settings?.voice || "alloy",
          }),
        });
        
        if (!tokenResponse.ok) {
          throw new Error(`Failed to get ephemeral token: ${tokenResponse.statusText}`);
        }
        
        const tokenData = await tokenResponse.json();
        console.log('Got ephemeral token for attempt:', connectionAttempts);
        
        // Connect to OpenAI Realtime API
        openAISocket = new WebSocket("wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17", {
          headers: {
            "Authorization": `Bearer ${tokenData.client_secret.value}`,
            "OpenAI-Beta": "realtime=v1",
          },
        });
        
        const handleOpenAIReconnect = () => {
          console.log('Handling OpenAI reconnection...');
          sessionReady = false;
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
          }
          
          // Only reconnect if Twilio connection is still open
          if (socket.readyState === WebSocket.OPEN && connectionAttempts < maxAttempts) {
            reconnectTimeout = setTimeout(() => {
              console.log('Attempting to reconnect to OpenAI...');
              connectToOpenAI();
            }, 1000 * connectionAttempts); // Exponential backoff
          }
        };
        
        openAISocket.onopen = () => {
          console.log(`OpenAI WebSocket connected successfully on attempt ${connectionAttempts}`);
          connectionAttempts = 0; // Reset attempts on successful connection
          
          // Start heartbeat to monitor connection health
          if (heartbeatInterval) clearInterval(heartbeatInterval);
          heartbeatInterval = setInterval(() => {
            if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
              // Send a ping to keep connection alive
              try {
                openAISocket.send(JSON.stringify({ type: 'ping' }));
                console.log('Sent heartbeat ping to OpenAI');
              } catch (error) {
                console.error('Failed to send heartbeat:', error);
                handleOpenAIReconnect();
              }
            }
          }, heartbeatIntervalMs);
        };
        
        openAISocket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          console.log('OpenAI event:', data.type);
          
          if (data.type === 'session.created') {
            // Configure the session
            const systemPrompt = agentConfig?.ai_agents?.system_prompt || 
              "You are a helpful voice assistant. Keep responses concise and conversational.";
            
            const sessionUpdate = {
              type: 'session.update',
              session: {
                modalities: ['text', 'audio'],
                instructions: systemPrompt,
                voice: agentConfig?.voice_settings?.voice || "alloy",
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
              }
            };
            
            openAISocket!.send(JSON.stringify(sessionUpdate));
            console.log('Session configuration sent');
          } else if (data.type === 'session.updated') {
            sessionReady = true;
            console.log('Session ready, processing buffered audio');
            
            // Process buffered audio
            while (audioBuffer.length > 0) {
              const bufferedAudio = audioBuffer.shift()!;
              if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
                openAISocket.send(bufferedAudio);
              }
            }
            
            // Send welcome message if configured
            const welcomeMessage = agentConfig?.voice_settings?.welcome_message;
            if (welcomeMessage) {
              const responseCreate = {
                type: 'response.create',
                response: {
                  modalities: ['audio'],
                  instructions: `Say this welcome message: "${welcomeMessage}"`
                }
              };
              openAISocket!.send(JSON.stringify(responseCreate));
            }
          } else if (data.type === 'response.audio.delta') {
            // Convert OpenAI PCM16 audio back to Twilio's μ-law format
            try {
              const pcm16Data = decodeAudioFromBase64(data.delta);
              const resampledPcm16 = resampleAudio(pcm16Data, 24000, 8000);
              const mulawData = pcm16ToMulaw(resampledPcm16);
              const base64Audio = encodeAudioToBase64(mulawData);
              
              const twilioMessage = {
                event: 'media',
                streamSid: callSid,
                media: {
                  payload: base64Audio
                }
              };
              
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify(twilioMessage));
              }
            } catch (error) {
              console.error('Error processing audio delta:', error);
            }
          } else if (data.type === 'response.audio_transcript.delta') {
            console.log('Assistant speech:', data.delta);
          } else if (data.type === 'input_audio_buffer.speech_started') {
            console.log('User started speaking');
          } else if (data.type === 'input_audio_buffer.speech_stopped') {
            console.log('User stopped speaking');
          } else if (data.type === 'error') {
            console.error('OpenAI error:', data.error);
            handleOpenAIReconnect();
          } else if (data.type === 'pong') {
            console.log('Received heartbeat pong from OpenAI');
          }
        };
        
        openAISocket.onerror = (error) => {
          console.error(`OpenAI WebSocket error (attempt ${connectionAttempts}):`, error);
          handleOpenAIReconnect();
        };
        
        openAISocket.onclose = (event) => {
          console.log(`OpenAI WebSocket closed (attempt ${connectionAttempts}), code: ${event.code}, reason: ${event.reason}`);
          if (event.code !== 1000) { // Not a normal closure
            handleOpenAIReconnect();
          }
        };
        
      } catch (error) {
        console.error(`Error setting up OpenAI connection (attempt ${connectionAttempts}):`, error);
        handleOpenAIReconnect();
      }
    };
    
    socket.onopen = async () => {
      console.log('Twilio WebSocket connected');
      await connectToOpenAI();
    };
    
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.event === 'start') {
        console.log('Call started:', message.start);
      } else if (message.event === 'media') {
        if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
          try {
            // Convert Twilio's μ-law audio to PCM16
            const mulawData = new Uint8Array(atob(message.media.payload).split('').map(c => c.charCodeAt(0)));
            const pcm16Data = mulawToPcm16(mulawData);
            const resampledPcm16 = resampleAudio(pcm16Data, 8000, 24000);
            const base64Audio = encodeAudioToBase64(resampledPcm16);
            
            const audioAppend = {
              type: 'input_audio_buffer.append',
              audio: base64Audio
            };
            
            const audioMessage = JSON.stringify(audioAppend);
            
            if (sessionReady) {
              openAISocket.send(audioMessage);
            } else {
              // Buffer audio until session is ready
              audioBuffer.push(audioMessage);
            }
          } catch (error) {
            console.error('Error processing incoming audio:', error);
          }
        }
      } else if (message.event === 'stop') {
        console.log('Call ended');
        cleanup();
      }
    };
    
    socket.onclose = () => {
      console.log('Twilio WebSocket closed');
      cleanup();
    };
    
    socket.onerror = (error) => {
      console.error('Twilio WebSocket error:', error);
      cleanup();
    };
    
    return response;
  }
  
  return new Response("Not found", { status: 404 });
});
