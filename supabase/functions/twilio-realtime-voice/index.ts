import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import "https://deno.land/x/xhr@0.1.0/mod.ts";

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Store active sessions
const activeSessions = new Map<string, {
  openAISocket: WebSocket | null;
  conversationId: string;
  agentConfig: any;
  audioBuffer: string[];
}>();

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const url = new URL(req.url);
  const callSid = url.searchParams.get('callSid');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  console.log('Real-time voice WebSocket connection request:', { callSid, from, to });

  if (!callSid || !from || !to) {
    return new Response("Missing required parameters", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = async () => {
    console.log('Twilio WebSocket connected for call:', callSid);
    await initializeRealtimeSession(socket, { callSid, from, to });
  };

  socket.onmessage = async (event) => {
    await handleTwilioMessage(event, callSid);
  };

  socket.onclose = () => {
    console.log('Twilio WebSocket closed for call:', callSid);
    cleanupSession(callSid);
  };

  socket.onerror = (error) => {
    console.error('Twilio WebSocket error:', error);
    cleanupSession(callSid);
  };

  return response;
});

async function initializeRealtimeSession(twilioSocket: WebSocket, params: { callSid: string, from: string, to: string }) {
  const { callSid, from, to } = params;
  
  try {
    // Find Twilio integration
    const phoneFormats = [
      to,
      to.replace(/\D/g, ''),
      `+1 ${to.slice(2, 5)} ${to.slice(5, 8)} ${to.slice(8)}`,
      `+${to.slice(1, 2)} ${to.slice(2, 5)} ${to.slice(5, 8)} ${to.slice(8)}`
    ];
    
    const { data: twilioIntegration, error: twilioError } = await supabase
      .from('twilio_integrations')
      .select('*')
      .in('phone_number', phoneFormats)
      .eq('is_active', true)
      .eq('voice_enabled', true)
      .single();

    if (twilioError || !twilioIntegration) {
      console.error('No Twilio integration found');
      twilioSocket.close();
      return;
    }

    // Get agent details
    const { data: agent, error: agentError } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', twilioIntegration.agent_id)
      .single();

    if (agentError || !agent) {
      console.error('No agent found');
      twilioSocket.close();
      return;
    }

    // Create conversation record
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        client_id: twilioIntegration.client_id,
        agent_id: agent.id,
        communication_channel: 'voice',
        phone_number: from,
        twilio_session_id: callSid,
        status: 'active',
        metadata: { call_sid: callSid, real_time: true }
      })
      .select('id')
      .single();

    if (convError || !conversation) {
      console.error('Failed to create conversation');
      twilioSocket.close();
      return;
    }

    // Connect to OpenAI Realtime API
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('OpenAI API key not configured');
      twilioSocket.close();
      return;
    }

    console.log('Connecting to OpenAI Realtime API...');
    const openAISocket = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    // Store session
    activeSessions.set(callSid, {
      openAISocket,
      conversationId: conversation.id,
      agentConfig: { agent, clientId: twilioIntegration.client_id },
      audioBuffer: []
    });

    // Setup OpenAI handlers
    openAISocket.onopen = () => {
      console.log('OpenAI WebSocket connected');
      
      // Configure session
      const sessionConfig = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: agent.system_prompt || 'You are a helpful AI customer service agent. Keep responses conversational and natural for voice calls.',
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
          temperature: 0.8,
          max_response_output_tokens: 'inf'
        }
      };
      
      openAISocket.send(JSON.stringify(sessionConfig));
    };

    openAISocket.onmessage = async (event) => {
      await handleOpenAIMessage(event, callSid, twilioSocket);
    };

    openAISocket.onclose = () => {
      console.log('OpenAI WebSocket closed');
      cleanupSession(callSid);
    };

    openAISocket.onerror = (error) => {
      console.error('OpenAI WebSocket error:', error);
      cleanupSession(callSid);
    };

  } catch (error) {
    console.error('Error initializing realtime session:', error);
    twilioSocket.close();
  }
}

async function handleTwilioMessage(event: MessageEvent, callSid: string) {
  try {
    const message = JSON.parse(event.data);
    const session = activeSessions.get(callSid);
    
    if (!session?.openAISocket) return;

    console.log('Twilio message event:', message.event);

    if (message.event === 'media') {
      // Forward audio to OpenAI
      const audioEvent = {
        type: 'input_audio_buffer.append',
        audio: message.media.payload
      };
      
      if (session.openAISocket.readyState === WebSocket.OPEN) {
        session.openAISocket.send(JSON.stringify(audioEvent));
      }
    } else if (message.event === 'start') {
      console.log('Media stream started');
    } else if (message.event === 'stop') {
      console.log('Media stream stopped');
      cleanupSession(callSid);
    }
  } catch (error) {
    console.error('Error handling Twilio message:', error);
  }
}

async function handleOpenAIMessage(event: MessageEvent, callSid: string, twilioSocket: WebSocket) {
  try {
    const message = JSON.parse(event.data);
    const session = activeSessions.get(callSid);
    
    if (!session) return;

    console.log('OpenAI message type:', message.type);

    switch (message.type) {
      case 'session.created':
        console.log('OpenAI session created successfully');
        break;
        
      case 'response.audio.delta':
        // Stream audio back to Twilio
        if (twilioSocket.readyState === WebSocket.OPEN) {
          const mediaMessage = {
            event: 'media',
            streamSid: callSid,
            media: {
              payload: message.delta
            }
          };
          twilioSocket.send(JSON.stringify(mediaMessage));
        }
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        // Store user message
        if (message.transcript) {
          await supabase
            .from('messages')
            .insert({
              conversation_id: session.conversationId,
              role: 'user',
              content: message.transcript,
              metadata: { channel: 'voice', call_sid: callSid, real_time: true }
            });
        }
        break;
        
      case 'response.text.done':
        // Store AI response
        if (message.text) {
          await supabase
            .from('messages')
            .insert({
              conversation_id: session.conversationId,
              role: 'assistant',
              content: message.text,
              metadata: { channel: 'voice', call_sid: callSid, real_time: true }
            });
        }
        break;
        
      case 'error':
        console.error('OpenAI API error:', message.error);
        break;
    }
  } catch (error) {
    console.error('Error handling OpenAI message:', error);
  }
}

function cleanupSession(callSid: string) {
  const session = activeSessions.get(callSid);
  if (session) {
    if (session.openAISocket?.readyState === WebSocket.OPEN) {
      session.openAISocket.close();
    }
    activeSessions.delete(callSid);
    console.log('Session cleaned up for call:', callSid);
  }
}