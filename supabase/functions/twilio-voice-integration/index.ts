import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle WebSocket upgrade for real-time voice streaming
  if (upgradeHeader.toLowerCase() === "websocket") {
    console.log('🔌 WebSocket upgrade requested');
    
    const { socket, response } = Deno.upgradeWebSocket(req);
    const url = new URL(req.url);
    const callSid = url.searchParams.get('callSid');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    
    console.log('📞 Voice call WebSocket connection:', { callSid, from, to });

    let openAISocket: WebSocket | null = null;

    socket.onopen = async () => {
      console.log('✅ Client WebSocket connected');
      
      try {
        // Get client configuration based on phone number
        const configResponse = await fetch('https://ycvvuepfsebqpwmamqgg.supabase.co/functions/v1/twilio-client-config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            twilioNumber: to,
            callerNumber: from
          })
        });

        const configData = await configResponse.json();
        
        if (configData.success && configData.config) {
          console.log('📋 Client config loaded:', configData.config.clientName);
          
          // Connect to OpenAI Realtime API
          const openaiApiKey = configData.config.openaiApiKey || Deno.env.get('OPENAI_API_KEY');
          
          if (openaiApiKey) {
            openAISocket = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'OpenAI-Beta': 'realtime=v1'
              }
            });

            openAISocket.onopen = () => {
              console.log('🤖 Connected to OpenAI Realtime API');
              
              // Configure session
              openAISocket?.send(JSON.stringify({
                type: 'session.update',
                session: {
                  modalities: ['text', 'audio'],
                  instructions: configData.config.systemPrompt || 'You are a helpful AI assistant for voice calls.',
                  voice: configData.config.voice || 'alloy',
                  input_audio_format: 'g711_ulaw',
                  output_audio_format: 'g711_ulaw',
                  turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 1000
                  },
                  temperature: 0.8
                }
              }));
            };

            openAISocket.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data);
                console.log('🤖 OpenAI message:', data.type);
                
                // Forward OpenAI responses to Twilio
                if (data.type === 'response.audio.delta') {
                  socket.send(JSON.stringify({
                    event: 'media',
                    streamSid: callSid,
                    media: {
                      payload: data.delta
                    }
                  }));
                }
              } catch (error) {
                console.error('Error parsing OpenAI message:', error);
              }
            };

            openAISocket.onerror = (error) => {
              console.error('🚨 OpenAI WebSocket error:', error);
            };

            openAISocket.onclose = () => {
              console.log('🤖 OpenAI WebSocket closed');
            };
          }
        }
      } catch (error) {
        console.error('Error setting up voice integration:', error);
      }
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📱 Twilio message:', message.event);
        
        if (message.event === 'media' && openAISocket?.readyState === WebSocket.OPEN) {
          // Forward audio from Twilio to OpenAI
          openAISocket.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: message.media.payload
          }));
        }
        
        if (message.event === 'start') {
          console.log('📞 Call started:', message.start);
        }
        
        if (message.event === 'stop') {
          console.log('📞 Call ended');
          openAISocket?.close();
        }
      } catch (error) {
        console.error('Error processing Twilio message:', error);
      }
    };

    socket.onclose = () => {
      console.log('📱 Twilio WebSocket closed');
      openAISocket?.close();
    };

    socket.onerror = (error) => {
      console.error('🚨 Twilio WebSocket error:', error);
      openAISocket?.close();
    };

    return response;
  }

  // Handle HTTP requests for incoming calls
  if (req.method === 'POST') {
    try {
      const formData = await req.formData();
      const from = formData.get('From') as string;
      const to = formData.get('To') as string;
      const callSid = formData.get('CallSid') as string;
      
      console.log('📞 Incoming call:', { from, to, callSid });
      
      // Generate TwiML response to connect call to media stream
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Connect>
          <Stream url="wss://ycvvuepfsebqpwmamqgg.supabase.co/functions/v1/twilio-voice-integration?callSid=${callSid}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}" />
        </Connect>
      </Response>`;

      return new Response(twiml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    } catch (error) {
      console.error('Error handling incoming call:', error);
      
      const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say>Sorry, we're experiencing technical difficulties. Please try again later.</Say>
      </Response>`;
      
      return new Response(errorTwiml, {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }
  }

  return new Response('Method not allowed', { 
    status: 405,
    headers: corsHeaders 
  });
});