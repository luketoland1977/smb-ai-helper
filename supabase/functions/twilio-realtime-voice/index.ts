import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Active sessions to track ongoing calls
const activeSessions = new Map();

serve(async (req) => {
  console.log('=== TWILIO REALTIME VOICE FUNCTION CALLED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log('❌ Non-WebSocket request received');
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  console.log('✅ WebSocket upgrade request received');
  
  try {
    // Extract parameters from URL
    const url = new URL(req.url);
    const callSid = url.searchParams.get('callSid');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    
    console.log('📞 Call parameters:', { callSid, from, to });

    // Get agent configuration
    const { data: twilioIntegration } = await supabase
      .from('twilio_integrations')
      .select(`
        *,
        ai_agents (
          id,
          name,
          system_prompt,
          settings
        )
      `)
      .eq('phone_number', '(844) 789-0436')
      .single();

    const agent = twilioIntegration?.ai_agents;
    const systemPrompt = agent?.system_prompt || `You are PRO WEB SUPPORT, a helpful AI assistant conducting a phone conversation. 

Guidelines:
- Keep responses natural and conversational for voice
- Be polite, professional, and helpful
- Listen carefully and respond appropriately
- Keep responses concise but complete
- Ask clarifying questions when needed

You are speaking directly with a customer over the phone right now.`;

    // Get welcome message
    const voiceSettings = twilioIntegration?.voice_settings || {};
    const welcomeMessage = voiceSettings.welcome_message || "Thank you for calling PRO WEB SUPPORT! How can I help you today?";

    console.log('🤖 Using agent:', agent?.name);
    console.log('💬 Welcome message:', welcomeMessage);

    // Upgrade to WebSocket
    const { socket, response } = Deno.upgradeWebSocket(req);
    let openAISocket = null;

    socket.onopen = async () => {
      console.log('🔗 Twilio WebSocket connected for call:', callSid);
      
      // Connect to OpenAI Realtime API
      try {
        const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openAIApiKey) {
          console.error('❌ OpenAI API key not found');
          socket.close();
          return;
        }

        console.log('🧠 Connecting to OpenAI Realtime API...');
        openAISocket = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'OpenAI-Beta': 'realtime=v1'
          }
        });

        openAISocket.onopen = () => {
          console.log('🧠 OpenAI connection established');
        };

        openAISocket.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('🧠 OpenAI event:', data.type);

            if (data.type === 'session.created') {
              console.log('🧠 Configuring OpenAI session...');
              
              const sessionConfig = {
                type: 'session.update',
                session: {
                  modalities: ['text', 'audio'],
                  instructions: systemPrompt,
                  voice: voiceSettings.voice || 'alloy',
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
                  max_response_output_tokens: 1000
                }
              };

              openAISocket.send(JSON.stringify(sessionConfig));

              // Send initial greeting
              setTimeout(() => {
                const greetingEvent = {
                  type: 'conversation.item.create',
                  item: {
                    type: 'message',
                    role: 'assistant',
                    content: [{ type: 'input_text', text: welcomeMessage }]
                  }
                };
                
                openAISocket.send(JSON.stringify(greetingEvent));
                openAISocket.send(JSON.stringify({ type: 'response.create' }));
                console.log('💬 Sent greeting to OpenAI');
              }, 500);

            } else if (data.type === 'response.audio.delta') {
              // Convert PCM16 to Mulaw for Twilio
              const encodedAudio = convertPCMToMulaw(data.delta);
              
              const mediaMessage = {
                event: "media",
                streamSid: callSid,
                media: {
                  track: "outbound",
                  chunk: Math.random().toString(),
                  timestamp: Date.now().toString(),
                  payload: encodedAudio
                }
              };
              
              socket.send(JSON.stringify(mediaMessage));
            }

          } catch (error) {
            console.error('❌ Error processing OpenAI message:', error);
          }
        };

        openAISocket.onerror = (error) => {
          console.error('❌ OpenAI WebSocket error:', error);
        };

        // Store session
        activeSessions.set(callSid, { twilioSocket: socket, openAISocket });

      } catch (error) {
        console.error('❌ Error connecting to OpenAI:', error);
        socket.close();
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.event === "media" && openAISocket && openAISocket.readyState === WebSocket.OPEN) {
          // Convert Mulaw to PCM16 for OpenAI
          const pcmAudio = convertMulawToPCM(data.media.payload);
          
          const audioEvent = {
            type: 'input_audio_buffer.append',
            audio: pcmAudio
          };
          
          openAISocket.send(JSON.stringify(audioEvent));
        }
        
      } catch (error) {
        console.error('❌ Error processing Twilio message:', error);
      }
    };

    socket.onclose = () => {
      console.log('🔌 Twilio WebSocket closed');
      const session = activeSessions.get(callSid);
      if (session?.openAISocket) {
        session.openAISocket.close();
      }
      activeSessions.delete(callSid);
    };

    return response;

  } catch (error) {
    console.error('💥 Error in WebSocket setup:', error);
    return new Response(`WebSocket setup failed: ${error.message}`, { status: 500 });
  }
});

// Audio conversion functions (simplified)
function convertPCMToMulaw(base64PCM) {
  // For now, return the base64 as-is (this needs proper conversion)
  return base64PCM;
}

function convertMulawToPCM(base64Mulaw) {
  // For now, return the base64 as-is (this needs proper conversion)
  return base64Mulaw;
}