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
  console.log('Request method:', req.method);
  console.log('Request headers:', Object.fromEntries(req.headers.entries()));
  
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log('❌ Not a WebSocket request:', upgradeHeader);
    return new Response("Expected WebSocket connection", { status: 426 });
  }

  try {
    const url = new URL(req.url);
    const callSid = url.searchParams.get('callSid');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    
    console.log('📞 Call:', { callSid, from, to });

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
      console.log('🔗 Twilio WebSocket connected successfully');
      
      // Initialize OpenAI connection
      try {
        const apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) {
          console.error('❌ No OpenAI API key');
          return;
        }

        console.log('🧠 Connecting to OpenAI...');
        openAISocket = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'OpenAI-Beta': 'realtime=v1'
          }
        });

        openAISocket.onopen = () => {
          console.log('🧠 OpenAI connected successfully');
        };

        openAISocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('🧠 OpenAI message:', data.type);
            
            if (data.type === 'session.created') {
              console.log('🧠 Session created, configuring...');
              
              const config = {
                type: 'session.update',
                session: {
                  modalities: ['text', 'audio'],
                  instructions: systemPrompt,
                  voice: 'alloy',
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
                }
              };
              
              openAISocket.send(JSON.stringify(config));
              console.log('🧠 Session configuration sent');
              
            } else if (data.type === 'session.updated') {
              console.log('🧠 Session updated, sending greeting...');
              
              // Send greeting now that session is updated
              const greeting = {
                type: 'conversation.item.create',
                item: {
                  type: 'message',
                  role: 'assistant',
                  content: [{ type: 'input_text', text: welcomeMessage }]
                }
              };
              
              openAISocket.send(JSON.stringify(greeting));
              openAISocket.send(JSON.stringify({ type: 'response.create' }));
              isOpenAIReady = true;
              console.log('💬 Greeting sent and ready for conversation');
              
            } else if (data.type === 'response.audio.delta' && socket.readyState === WebSocket.OPEN) {
              console.log('🔊 Sending audio chunk to Twilio');
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
              console.log('📝 Transcript:', data.delta);
              
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
          console.error('❌ OpenAI error:', error);
        };

        openAISocket.onclose = () => {
          console.log('🧠 OpenAI disconnected');
          isOpenAIReady = false;
        };

      } catch (error) {
        console.error('❌ OpenAI setup error:', error);
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 Twilio message:', data.event);
        
        if (data.event === "start") {
          console.log('🎬 Call started, stream active');
          
        } else if (data.event === "media") {
          // Forward audio to OpenAI if ready
          if (openAISocket?.readyState === WebSocket.OPEN && isOpenAIReady) {
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
          } else {
            console.log('⚠️ OpenAI not ready, dropping audio chunk');
          }
          
        } else if (data.event === "stop") {
          console.log('🛑 Call ended');
          if (openAISocket) {
            openAISocket.close();
          }
          socket.close();
        }
        
      } catch (error) {
        console.error('❌ Twilio message error:', error);
      }
    };

    socket.onclose = (event) => {
      console.log('🔌 Twilio WebSocket closed:', event.code, event.reason);
      if (openAISocket) {
        openAISocket.close();
      }
    };

    socket.onerror = (error) => {
      console.error('❌ Twilio WebSocket error:', error);
    };

    return response;

  } catch (error) {
    console.error('💥 Setup error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});