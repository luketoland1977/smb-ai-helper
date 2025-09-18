import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Audio conversion utilities for Twilio compatibility
function mulawToPcm16(mulawData: Uint8Array): Uint8Array {
  const pcm16Data = new Int16Array(mulawData.length);
  const mulawToLinear = [
    -32124,-31100,-30076,-29052,-28028,-27004,-25980,-24956,
    -23932,-22908,-21884,-20860,-19836,-18812,-17788,-16764,
    -15996,-15484,-14972,-14460,-13948,-13436,-12924,-12412,
    -11900,-11388,-10876,-10364, -9852, -9340, -8828, -8316,
     -7932, -7676, -7420, -7164, -6908, -6652, -6396, -6140,
     -5884, -5628, -5372, -5116, -4860, -4604, -4348, -4092,
     -3900, -3772, -3644, -3516, -3388, -3260, -3132, -3004,
     -2876, -2748, -2620, -2492, -2364, -2236, -2108, -1980,
     -1884, -1820, -1756, -1692, -1628, -1564, -1500, -1436,
     -1372, -1308, -1244, -1180, -1116, -1052,  -988,  -924,
      -876,  -844,  -812,  -780,  -748,  -716,  -684,  -652,
      -620,  -588,  -556,  -524,  -492,  -460,  -428,  -396,
      -372,  -356,  -340,  -324,  -308,  -292,  -276,  -260,
      -244,  -228,  -212,  -196,  -180,  -164,  -148,  -132,
      -120,  -112,  -104,   -96,   -88,   -80,   -72,   -64,
       -56,   -48,   -40,   -32,   -24,   -16,    -8,     0,
     32124, 31100, 30076, 29052, 28028, 27004, 25980, 24956,
     23932, 22908, 21884, 20860, 19836, 18812, 17788, 16764,
     15996, 15484, 14972, 14460, 13948, 13436, 12924, 12412,
     11900, 11388, 10876, 10364,  9852,  9340,  8828,  8316,
      7932,  7676,  7420,  7164,  6908,  6652,  6396,  6140,
      5884,  5628,  5372,  5116,  4860,  4604,  4348,  4092,
      3900,  3772,  3644,  3516,  3388,  3260,  3132,  3004,
      2876,  2748,  2620,  2492,  2364,  2236,  2108,  1980,
      1884,  1820,  1756,  1692,  1628,  1564,  1500,  1436,
      1372,  1308,  1244,  1180,  1116,  1052,   988,   924,
       876,   844,   812,   780,   748,   716,   684,   652,
       620,   588,   556,   524,   492,   460,   428,   396,
       372,   356,   340,   324,   308,   292,   276,   260,
       244,   228,   212,   196,   180,   164,   148,   132,
       120,   112,   104,    96,    88,    80,    72,    64,
        56,    48,    40,    32,    24,    16,     8,     0
  ];
  
  for (let i = 0; i < mulawData.length; i++) {
    pcm16Data[i] = mulawToLinear[mulawData[i]];
  }
  
  const uint8Array = new Uint8Array(pcm16Data.buffer);
  return uint8Array;
}

function pcm16ToMulaw(pcm16Data: Uint8Array): Uint8Array {
  const int16Data = new Int16Array(pcm16Data.buffer);
  const mulawData = new Uint8Array(int16Data.length);
  
  for (let i = 0; i < int16Data.length; i++) {
    const sample = int16Data[i];
    const sign = (sample >> 8) & 0x80;
    let magnitude = sample < 0 ? -sample : sample;
    magnitude = Math.min(magnitude, 32635);
    
    let exp = 7;
    let expMask = 0x4000;
    for (let j = 0; j < 8; j++) {
      if ((magnitude & expMask) !== 0) break;
      exp--;
      expMask >>= 1;
    }
    
    const mantissa = (magnitude >> (exp + 3)) & 0x0F;
    mulawData[i] = ~(sign | (exp << 4) | mantissa);
  }
  
  return mulawData;
}

// Convert PCM16 audio to base64 for OpenAI Realtime API
function encodeAudioToBase64(pcm16Data: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  
  for (let i = 0; i < pcm16Data.length; i += chunkSize) {
    const chunk = pcm16Data.subarray(i, Math.min(i + chunkSize, pcm16Data.length));
    binary += String.fromCharCode(...chunk);
  }
  
  return btoa(binary);
}

// Convert base64 audio from OpenAI to PCM16
function decodeAudioFromBase64(base64Audio: string): Uint8Array {
  const binary = atob(base64Audio);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Resample audio between sample rates
function resampleAudio(inputData: Uint8Array, inputSampleRate: number, outputSampleRate: number): Uint8Array {
  const inputSamples = new Int16Array(inputData.buffer);
  const resampleRatio = inputSampleRate / outputSampleRate;
  const outputLength = Math.floor(inputSamples.length / resampleRatio);
  const outputSamples = new Int16Array(outputLength);
  
  for (let i = 0; i < outputLength; i++) {
    const inputIndex = Math.floor(i * resampleRatio);
    outputSamples[i] = inputSamples[inputIndex] || 0;
  }
  
  return new Uint8Array(outputSamples.buffer);
}

serve(async (req) => {
  console.log('=== TWILIO REALTIME VOICE FUNCTION STARTED ===');
  
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log('❌ Not a WebSocket request');
    return new Response("Expected WebSocket connection", { status: 426 });
  }

  try {
    const url = new URL(req.url);
    const callSid = url.searchParams.get('callSid');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    
    console.log('📞 Incoming call:', { callSid, from, to });

    // Fetch agent configuration from database
    let agentConfig = {
      prompt: "You are a helpful customer service agent. Keep responses brief and conversational, under 2 sentences.",
      voice: "alloy",
      welcomeMessage: "Hello! Thank you for calling. How can I help you today?"
    };
    
    try {
      const { data: integration } = await supabase
        .from('twilio_integrations')
        .select(`*, ai_agents(*)`)
        .eq('phone_number', to)
        .single();

      if (integration?.ai_agents) {
        agentConfig.prompt = integration.ai_agents.system_prompt || agentConfig.prompt;
        agentConfig.voice = integration.voice_settings?.voice || agentConfig.voice;
        agentConfig.welcomeMessage = integration.voice_settings?.welcome_message || agentConfig.welcomeMessage;
        console.log('✅ Loaded agent configuration for', to);
      }
    } catch (error) {
      console.log('⚠️ Using default agent configuration:', error.message);
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    let openAISocket: WebSocket | null = null;
    let sessionReady = false;

    socket.onopen = async () => {
      console.log('🔗 Twilio WebSocket connected');
      
      try {
        // Connect to OpenAI Realtime API
        const apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) {
          throw new Error('OpenAI API key not found');
        }

        console.log('🤖 Connecting to OpenAI Realtime API...');
        openAISocket = new WebSocket(
          "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
          [],
          {
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "OpenAI-Beta": "realtime=v1"
            }
          }
        );

        openAISocket.onopen = () => {
          console.log('✅ Connected to OpenAI Realtime API');
        };

        openAISocket.onmessage = async (event) => {
          try {
            const openAIData = JSON.parse(event.data);
            console.log('🤖 OpenAI event:', openAIData.type);

            if (openAIData.type === 'session.created') {
              console.log('🎬 OpenAI session created, configuring...');
              
              // Configure session with agent settings
              const sessionUpdate = {
                type: 'session.update',
                session: {
                  modalities: ['text', 'audio'],
                  instructions: agentConfig.prompt,
                  voice: agentConfig.voice,
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
                  temperature: 0.7,
                  max_response_output_tokens: 'inf'
                }
              };
              
              openAISocket?.send(JSON.stringify(sessionUpdate));
              
            } else if (openAIData.type === 'session.updated') {
              console.log('✅ OpenAI session configured');
              sessionReady = true;
              
              // Send welcome message
              const welcomeEvent = {
                type: 'conversation.item.create',
                item: {
                  type: 'message',
                  role: 'assistant',
                  content: [
                    {
                      type: 'input_text',
                      text: agentConfig.welcomeMessage
                    }
                  ]
                }
              };
              
              openAISocket?.send(JSON.stringify(welcomeEvent));
              openAISocket?.send(JSON.stringify({ type: 'response.create' }));
              
            } else if (openAIData.type === 'response.audio.delta') {
              // Convert OpenAI audio to Twilio format
              const pcm16Data = decodeAudioFromBase64(openAIData.delta);
              
              // Resample from 24kHz to 8kHz for Twilio
              const resampledData = resampleAudio(pcm16Data, 24000, 8000);
              const mulawData = pcm16ToMulaw(resampledData);
              
              // Send to Twilio in chunks
              const chunkSize = 160; // 20ms at 8kHz
              for (let i = 0; i < mulawData.length; i += chunkSize) {
                const chunk = mulawData.slice(i, i + chunkSize);
                const base64Chunk = btoa(String.fromCharCode(...chunk));
                
                const mediaMsg = {
                  event: "media",
                  streamSid: callSid,
                  media: {
                    track: "outbound",
                    chunk: (Math.floor(i / chunkSize)).toString(),
                    timestamp: Date.now().toString(),
                    payload: base64Chunk
                  }
                };
                
                socket.send(JSON.stringify(mediaMsg));
                
                // Small delay between chunks
                if (i + chunkSize < mulawData.length) {
                  await new Promise(resolve => setTimeout(resolve, 20));
                }
              }
              
            } else if (openAIData.type === 'response.audio_transcript.delta') {
              console.log('📝 AI said:', openAIData.delta);
              
            } else if (openAIData.type === 'input_audio_buffer.speech_started') {
              console.log('👂 User started speaking');
              
            } else if (openAIData.type === 'input_audio_buffer.speech_stopped') {
              console.log('✋ User stopped speaking');
              
            } else if (openAIData.type === 'conversation.item.input_audio_transcription.completed') {
              console.log('📝 User said:', openAIData.transcript);
              
            } else if (openAIData.type === 'error') {
              console.error('❌ OpenAI API error:', openAIData.error);
            }
            
          } catch (parseError) {
            console.error('❌ Error parsing OpenAI message:', parseError);
          }
        };

        openAISocket.onerror = (error) => {
          console.error('❌ OpenAI WebSocket error:', error);
        };

        openAISocket.onclose = (event) => {
          console.log('🔌 OpenAI WebSocket closed:', event.code, event.reason);
        };

      } catch (error) {
        console.error('❌ Error connecting to OpenAI:', error);
      }
    };

    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.event === "start") {
          console.log('🎬 Call started');
          
        } else if (data.event === "media" && sessionReady && openAISocket) {
          // Convert Twilio audio to OpenAI format
          const audioPayload = atob(data.media.payload);
          const mulawData = new Uint8Array(audioPayload.length);
          for (let i = 0; i < audioPayload.length; i++) {
            mulawData[i] = audioPayload.charCodeAt(i);
          }
          
          const pcm16Data = mulawToPcm16(mulawData);
          
          // Resample from 8kHz to 24kHz for OpenAI
          const resampledData = resampleAudio(pcm16Data, 8000, 24000);
          const base64Audio = encodeAudioToBase64(resampledData);
          
          // Send to OpenAI
          const audioEvent = {
            type: 'input_audio_buffer.append',
            audio: base64Audio
          };
          
          openAISocket.send(JSON.stringify(audioEvent));
          
        } else if (data.event === "stop") {
          console.log('🛑 Call ended');
          openAISocket?.close();
          socket.close();
        }
        
      } catch (parseError) {
        console.error('❌ Error parsing Twilio message:', parseError);
      }
    };

    socket.onclose = (event) => {
      console.log('🔌 Twilio WebSocket closed:', event.code, event.reason);
      openAISocket?.close();
    };

    socket.onerror = (error) => {
      console.error('❌ Twilio WebSocket error:', error);
      openAISocket?.close();
    };

    return response;

  } catch (error) {
    console.error('💥 Function error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});