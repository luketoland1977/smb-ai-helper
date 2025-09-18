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
      prompt: "You are a helpful customer service agent. Assist customers professionally and friendly.",
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
    let isOpenAIReady = false;
    let audioBuffer: any[] = [];
    let conversationStarted = false;

    socket.onopen = async () => {
      console.log('🔗 Twilio WebSocket connected');
      
      try {
        const apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) {
          console.error('❌ No OpenAI API key found');
          socket.close(1011, 'No API key configured');
          return;
        }

        console.log('🧠 Creating OpenAI session...');
        
        // Create ephemeral token with proper error handling
        const tokenResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-realtime-preview-2024-12-17',
            voice: agentConfig.voice,
            instructions: agentConfig.prompt
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error('❌ Failed to create ephemeral token:', tokenResponse.status, errorText);
          socket.close(1011, 'OpenAI session creation failed');
          return;
        }

        const tokenData = await tokenResponse.json();
        console.log('✅ Ephemeral token created successfully');

        if (!tokenData.client_secret?.value) {
          console.error('❌ No client secret in token response');
          socket.close(1011, 'Invalid token response');
          return;
        }

        const ephemeralToken = tokenData.client_secret.value;
        console.log('🔗 Connecting to OpenAI WebSocket...');

        // Create WebSocket connection using the ephemeral token correctly
        // Based on OpenAI documentation, the ephemeral token should be used as the authorization
        const wsUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`;
        
        // The ephemeral token IS the authorization - use it directly as Bearer token
        // But for WebSocket, we need to pass it as a subprotocol or in a special way
        console.log('🔑 Using ephemeral token for WebSocket auth...');
        
        // Try passing the authorization in the WebSocket subprotocols
        openAISocket = new WebSocket(wsUrl, [`Bearer.${ephemeralToken.replace(/[^a-zA-Z0-9]/g, '_')}`]);
        
        openAISocket.onopen = () => {
          console.log('🧠 OpenAI WebSocket connected successfully');
        };

        openAISocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('🧠 OpenAI event:', data.type);
            
            if (data.type === 'session.created') {
              console.log('✅ Session created, configuring audio settings...');
              
              const sessionConfig = {
                type: 'session.update',
                session: {
                  modalities: ['audio'],
                  instructions: agentConfig.prompt,
                  voice: agentConfig.voice,
                  input_audio_format: 'pcm16',
                  output_audio_format: 'pcm16',
                  turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 1200
                  },
                  temperature: 0.8
                }
              };
              
              openAISocket?.send(JSON.stringify(sessionConfig));
              console.log('⚙️ Session configuration sent');
              
            } else if (data.type === 'session.updated') {
              console.log('✅ Session updated successfully');
              isOpenAIReady = true;
              
              // Process buffered audio
              if (audioBuffer.length > 0) {
                console.log(`📥 Processing ${audioBuffer.length} buffered audio chunks`);
                audioBuffer.forEach(audioEvent => {
                  openAISocket?.send(JSON.stringify(audioEvent));
                });
                audioBuffer = [];
                console.log('✅ Audio buffer processed');
              }
              
              // Send welcome message after configuration
              if (!conversationStarted) {
                conversationStarted = true;
                console.log('🎙️ Sending welcome message...');
                
                const welcomeEvent = {
                  type: 'conversation.item.create',
                  item: {
                    type: 'message',
                    role: 'assistant',
                    content: [{
                      type: 'input_text',
                      text: agentConfig.welcomeMessage
                    }]
                  }
                };
                
                openAISocket?.send(JSON.stringify(welcomeEvent));
                openAISocket?.send(JSON.stringify({ type: 'response.create' }));
              }
              
            } else if (data.type === 'response.audio.delta' && socket.readyState === WebSocket.OPEN) {
              // Convert and forward audio to Twilio
              try {
                const audioData = atob(data.delta);
                const pcm16Data = new Uint8Array(audioData.length);
                for (let i = 0; i < audioData.length; i++) {
                  pcm16Data[i] = audioData.charCodeAt(i);
                }
                
                const mulawData = pcm16ToMulaw(pcm16Data);
                const base64Mulaw = btoa(String.fromCharCode(...mulawData));
                
                const mediaMsg = {
                  event: "media",
                  streamSid: callSid,
                  media: {
                    track: "outbound",
                    chunk: Date.now().toString(),
                    timestamp: Date.now().toString(),
                    payload: base64Mulaw
                  }
                };
                
                socket.send(JSON.stringify(mediaMsg));
                
              } catch (audioError) {
                console.error('❌ Audio conversion error:', audioError);
              }
              
            } else if (data.type === 'response.audio_transcript.delta') {
              console.log('📝 Assistant:', data.delta);
            } else if (data.type === 'input_audio_buffer.speech_started') {
              console.log('🎤 User started speaking');
            } else if (data.type === 'input_audio_buffer.speech_stopped') {
              console.log('🎤 User stopped speaking');
            } else if (data.type === 'error') {
              console.error('❌ OpenAI error:', data);
            }
            
          } catch (parseError) {
            console.error('❌ Error parsing OpenAI message:', parseError);
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

      } catch (setupError) {
        console.error('❌ OpenAI setup error:', setupError);
        socket.close(1011, 'OpenAI setup failed');
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.event === "start") {
          console.log('🎬 Call started');
          
        } else if (data.event === "media") {
          // Handle incoming audio from Twilio
          if (isOpenAIReady && openAISocket?.readyState === WebSocket.OPEN) {
            try {
              const audioPayload = atob(data.media.payload);
              const mulawData = new Uint8Array(audioPayload.length);
              for (let i = 0; i < audioPayload.length; i++) {
                mulawData[i] = audioPayload.charCodeAt(i);
              }
              
              const pcm16Data = mulawToPcm16(mulawData);
              const base64Pcm16 = btoa(String.fromCharCode(...pcm16Data));
              
              const audioEvent = {
                type: 'input_audio_buffer.append',
                audio: base64Pcm16
              };
              
              openAISocket.send(JSON.stringify(audioEvent));
            } catch (audioError) {
              console.error('❌ Audio processing error:', audioError);
            }
          } else {
            // Buffer audio while OpenAI is not ready
            try {
              const audioPayload = atob(data.media.payload);
              const mulawData = new Uint8Array(audioPayload.length);
              for (let i = 0; i < audioPayload.length; i++) {
                mulawData[i] = audioPayload.charCodeAt(i);
              }
              
              const pcm16Data = mulawToPcm16(mulawData);
              const base64Pcm16 = btoa(String.fromCharCode(...pcm16Data));
              
              const audioEvent = {
                type: 'input_audio_buffer.append',
                audio: base64Pcm16
              };
              
              if (audioBuffer.length < 50) {
                audioBuffer.push(audioEvent);
              } else {
                // Remove oldest chunk to prevent memory issues
                audioBuffer.shift();
                audioBuffer.push(audioEvent);
              }
            } catch (bufferError) {
              console.error('❌ Audio buffering error:', bufferError);
            }
          }
          
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