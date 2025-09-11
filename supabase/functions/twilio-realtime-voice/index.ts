import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  console.log('=== TWILIO REALTIME VOICE FUNCTION CALLED ===');
  
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
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

    const { socket, response } = Deno.upgradeWebSocket(req, {
      idleTimeout: 300,
    });
    
    let openAISocket = null;
    let isOpenAIReady = false;

    socket.onopen = async () => {
      console.log('🔗 Twilio connected');
      
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
          console.log('🧠 OpenAI connected');
        };

        openAISocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'session.created') {
              console.log('🧠 Configuring session...');
              
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
              
              // Send greeting after a delay
              setTimeout(() => {
                if (openAISocket?.readyState === WebSocket.OPEN) {
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
                  console.log('💬 Sent greeting');
                }
              }, 1000);
              
            } else if (data.type === 'response.audio.delta' && socket.readyState === WebSocket.OPEN) {
              // Send AI audio to Twilio
              const mediaMsg = {
                event: "media",
                streamSid: callSid,
                media: {
                  track: "outbound",
                  chunk: Math.random().toString(),
                  timestamp: Date.now().toString(),
                  payload: data.delta // OpenAI sends base64 PCM16, we'll send it as-is for now
                }
              };
              
              socket.send(JSON.stringify(mediaMsg));
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
        
        if (data.event === "start") {
          console.log('🎬 Call started');
          
        } else if (data.event === "media") {
          // Forward audio to OpenAI if ready
          if (openAISocket?.readyState === WebSocket.OPEN && isOpenAIReady) {
            const audioEvent = {
              type: 'input_audio_buffer.append',
              audio: data.media.payload // Twilio sends base64 mulaw, we'll send as-is for now
            };
            
            openAISocket.send(JSON.stringify(audioEvent));
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
      console.log('🔌 Twilio closed:', event.code, event.reason);
      if (openAISocket) {
        openAISocket.close();
      }
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