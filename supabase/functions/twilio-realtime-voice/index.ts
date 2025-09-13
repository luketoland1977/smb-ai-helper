import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Audio conversion utilities
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

serve(async (req) => {
  console.log('=== TWILIO REALTIME VOICE FUNCTION CALLED ===');
  
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
    
    console.log('📞 Call details:', { callSid, from, to });

    // Get agent configuration
    let welcomeMessage = "Hello! Thank you for calling PRO WEB SUPPORT. How can I help you today?";
    let systemPrompt = "You are PRO WEB SUPPORT, a helpful AI assistant. Keep responses conversational and concise for voice calls.";
    
    try {
      const { data: integration } = await supabase
        .from('twilio_integrations')
        .select(`*, ai_agents(*)`)
        .eq('phone_number', '(844) 789-0436')
        .single();

      if (integration?.ai_agents) {
        systemPrompt = integration.ai_agents.system_prompt || systemPrompt;
        welcomeMessage = integration.voice_settings?.welcome_message || welcomeMessage;
        console.log('✅ Loaded agent config');
      }
    } catch (error) {
      console.log('⚠️ Using default config:', error.message);
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    
    let openAISocket = null;
    let isOpenAIReady = false;

    socket.onopen = async () => {
      console.log('🔗 Twilio WebSocket connected');
      
      try {
        const apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) {
          console.error('❌ No OpenAI API key');
          socket.close();
          return;
        }

        console.log('🧠 Creating OpenAI realtime session...');
        
        // Create ephemeral session directly
        const sessionResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-realtime-preview-2024-12-17',
            voice: 'alloy',
            instructions: systemPrompt,
            modalities: ['text', 'audio'],
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: { model: 'whisper-1' },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 1000
            },
            temperature: 0.8
          }),
        });

        if (!sessionResponse.ok) {
          const errorText = await sessionResponse.text();
          console.error('❌ Session creation failed:', sessionResponse.status, errorText);
          throw new Error(`Failed to create session: ${sessionResponse.status} ${errorText}`);
        }

        const sessionData = await sessionResponse.json();
        const ephemeralToken = sessionData.client_secret?.value;
        
        if (!ephemeralToken) {
          console.error('❌ No ephemeral token in response:', JSON.stringify(sessionData));
          throw new Error('No ephemeral token received');
        }

        console.log('✅ Got ephemeral token, connecting WebSocket...');
        
        // Now connect to WebSocket with ephemeral token
        const wsUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`;
        
        // Since Deno WebSocket doesn't support custom headers, we need to include auth in URL query
        const authenticatedWsUrl = `${wsUrl}&authorization=${encodeURIComponent(`Bearer ${ephemeralToken}`)}`;
        
        openAISocket = new WebSocket(authenticatedWsUrl);

        openAISocket.onopen = () => {
          console.log('🧠 OpenAI WebSocket connected successfully!');
          isOpenAIReady = true;
          
          // Send welcome message
          const greetingResponse = {
            type: 'response.create',
            response: {
              modalities: ['audio'],
              instructions: `Say this welcome message: "${welcomeMessage}"`
            }
          };
          
          openAISocket.send(JSON.stringify(greetingResponse));
          console.log('🎙️ Welcome message sent');
        };

        openAISocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('🧠 OpenAI event:', data.type);
            
            if (data.type === 'response.audio.delta' && socket.readyState === WebSocket.OPEN) {
              console.log('🔊 Forwarding audio to Twilio');
              // Convert OpenAI PCM16 to mulaw for Twilio
              const pcm16Data = new Uint8Array(atob(data.delta).split('').map(c => c.charCodeAt(0)));
              const mulawData = pcm16ToMulaw(pcm16Data);
              const base64Mulaw = btoa(String.fromCharCode(...mulawData));
              
              const mediaMsg = {
                event: "media",
                streamSid: callSid,
                media: {
                  track: "outbound",
                  chunk: Math.random().toString(),
                  timestamp: Date.now().toString(),
                  payload: base64Mulaw
                }
              };
              
              socket.send(JSON.stringify(mediaMsg));
              
            } else if (data.type === 'response.audio_transcript.delta') {
              console.log('📝 AI said:', data.delta);
            } else if (data.type === 'input_audio_buffer.speech_started') {
              console.log('🎤 User started speaking');
            } else if (data.type === 'input_audio_buffer.speech_stopped') {
              console.log('🎤 User stopped speaking');
            }
            
          } catch (error) {
            console.error('❌ OpenAI message error:', error);
          }
        };

        openAISocket.onerror = (error) => {
          console.error('❌ OpenAI WebSocket error:', error);
          isOpenAIReady = false;
        };

        openAISocket.onclose = (event) => {
          console.log('🧠 OpenAI disconnected:', event.code, event.reason);
          isOpenAIReady = false;
        };

      } catch (error) {
        console.error('❌ OpenAI setup error:', error);
        socket.close();
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 Twilio:', data.event);
        
        if (data.event === "start") {
          console.log('🎬 Call started');
          
        } else if (data.event === "media" && isOpenAIReady) {
          // Forward audio to OpenAI
          if (openAISocket?.readyState === WebSocket.OPEN) {
            try {
              // Convert Twilio mulaw to PCM16 for OpenAI
              const mulawData = new Uint8Array(atob(data.media.payload).split('').map(c => c.charCodeAt(0)));
              const pcm16Data = mulawToPcm16(mulawData);
              const base64Pcm16 = btoa(String.fromCharCode(...pcm16Data));
              
              const audioEvent = {
                type: 'input_audio_buffer.append',
                audio: base64Pcm16
              };
              
              openAISocket.send(JSON.stringify(audioEvent));
            } catch (error) {
              console.error('❌ Audio conversion error:', error);
            }
          }
          
        } else if (data.event === "media" && !isOpenAIReady) {
          console.log('⚠️ OpenAI not ready, dropping audio chunk');
          
        } else if (data.event === "stop") {
          console.log('🛑 Call ended');
          openAISocket?.close();
          socket.close();
        }
        
      } catch (error) {
        console.error('❌ Twilio message error:', error);
      }
    };

    socket.onclose = (event) => {
      console.log('🔌 Twilio closed:', event.code, event.reason);
      openAISocket?.close();
    };

    socket.onerror = (error) => {
      console.error('❌ Twilio error:', error);
    };

    return response;

  } catch (error) {
    console.error('💥 Setup error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});