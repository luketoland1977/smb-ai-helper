import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Store active conversations for WebSocket management
const activeConversations = new Map<string, {
  openAISocket: WebSocket | null;
  twilioSocket: WebSocket | null;
  conversationId: string;
  agentConfig: any;
}>();

// Search knowledge base for relevant content
async function searchKnowledgeBase(clientId: string, query: string): Promise<string | null> {
  try {
    console.log('Searching knowledge base for client:', clientId, 'query:', query);
    
    const { data: chunks, error } = await supabase
      .from('knowledge_base_chunks')
      .select('content, metadata')
      .eq('client_id', clientId)
      .textSearch('content', query.split(' ').join(' | '))
      .limit(3);

    if (error) {
      console.error('Knowledge base search error:', error);
      return null;
    }

    if (!chunks || chunks.length === 0) {
      console.log('No relevant knowledge base content found');
      return null;
    }

    const context = chunks
      .map(chunk => chunk.content)
      .join('\n\n---\n\n');

    console.log('Found relevant knowledge base content:', chunks.length, 'chunks');
    return context;
  } catch (error) {
    console.error('Error searching knowledge base:', error);
    return null;
  }
}

serve(async (req) => {
  console.log('=== TWILIO VOICE WEBHOOK CALLED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  // Check if this is a WebSocket upgrade request
  const upgradeHeader = req.headers.get("upgrade");
  if (upgradeHeader?.toLowerCase() === "websocket") {
    console.log('Handling WebSocket upgrade for real-time voice streaming');
    return handleWebSocketUpgrade(req);
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'incoming';
    console.log('Action parameter:', action);

    // Parse form data from Twilio webhook
    console.log('Parsing form data...');
    const formData = await req.formData();
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const callSid = formData.get('CallSid') as string;

    console.log('Form data parsed:', { from, to, callSid });
    console.log('Voice webhook called:', { action, from, to, callSid });

    if (action === 'incoming') {
      // Handle incoming call - start Media Stream for real-time voice
      const streamUrl = `wss://ycvvuepfsebqpwmamqgg.supabase.co/functions/v1/twilio-voice-webhook?action=stream&callSid=${callSid}&from=${from}&to=${to}`;
      console.log('Setting up Media Stream for real-time voice:', streamUrl);
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Hello! Connecting you to our AI assistant with real-time voice.</Say>
    <Connect>
        <Stream url="${streamUrl}">
            <Parameter name="callSid" value="${callSid}" />
            <Parameter name="from" value="${from}" />
            <Parameter name="to" value="${to}" />
        </Stream>
    </Connect>
</Response>`;

      console.log('Generated TwiML for real-time voice streaming:', twiml);
      return new Response(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Default response for unknown actions
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, there was an error processing your call. Please try again later. Goodbye!</Say>
</Response>`;

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('Error in voice webhook:', error);
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, I'm experiencing technical difficulties. Please try again later. Goodbye!</Say>
</Response>`;

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
});

// Handle WebSocket upgrade for Media Stream
function handleWebSocketUpgrade(req: Request): Response {
  const url = new URL(req.url);
  const callSid = url.searchParams.get('callSid');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  console.log('WebSocket upgrade params:', { callSid, from, to });

  if (!callSid || !from || !to) {
    return new Response('Missing required parameters', { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  socket.onopen = async () => {
    console.log('Twilio WebSocket connected for call:', callSid);
    await setupRealtimeVoiceSession(socket, { callSid, from, to });
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
}

// Setup real-time voice session with OpenAI
async function setupRealtimeVoiceSession(twilioSocket: WebSocket, params: { callSid: string, from: string, to: string }) {
  const { callSid, from, to } = params;
  
  try {
    // Find Twilio integration by phone number
    console.log('Looking for Twilio integration with phone number:', to);
    
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
      console.error('No Twilio integration found for number:', to);
      twilioSocket.close();
      return;
    }

    const clientId = twilioIntegration.client_id;
    const agentId = twilioIntegration.agent_id;

    // Get the agent details
    const { data: agent, error: agentError } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      console.error('No agent found for ID:', agentId);
      twilioSocket.close();
      return;
    }

    // Create conversation record
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        client_id: clientId,
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
      console.error('Failed to create conversation:', convError);
      twilioSocket.close();
      return;
    }

    // Connect to OpenAI Real-time API
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('OpenAI API key not configured');
      twilioSocket.close();
      return;
    }

    console.log('Connecting to OpenAI Real-time API...');
    const openAISocket = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    // Store session info
    activeConversations.set(callSid, {
      openAISocket,
      twilioSocket,
      conversationId: conversation.id,
      agentConfig: { agent, clientId }
    });

    // Setup OpenAI WebSocket handlers
    openAISocket.onopen = () => {
      console.log('OpenAI WebSocket connected');
      
      // Send session configuration
      const sessionConfig = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: agent.system_prompt || `You are a helpful AI customer service agent. You assist customers with their inquiries in a friendly and professional manner via phone calls.

Guidelines:
- Keep responses conversational and natural for voice
- Be polite and helpful
- Provide accurate information based on the knowledge base when available
- Ask clarifying questions when needed
- Speak clearly and at a moderate pace
- If the conversation seems complete, offer to help with anything else or say goodbye`,
          voice: 'alloy',
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
          max_response_output_tokens: 'inf'
        }
      };
      
      console.log('Sending session configuration to OpenAI');
      openAISocket.send(JSON.stringify(sessionConfig));
    };

    openAISocket.onmessage = async (event) => {
      await handleOpenAIMessage(event, callSid);
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
    console.error('Error setting up real-time voice session:', error);
    twilioSocket.close();
  }
}

// Handle messages from Twilio Media Stream
async function handleTwilioMessage(event: MessageEvent, callSid: string) {
  try {
    const message = JSON.parse(event.data);
    const session = activeConversations.get(callSid);
    
    if (!session || !session.openAISocket) {
      console.log('No active session found for call:', callSid);
      return;
    }

    console.log('Twilio message type:', message.event);

    if (message.event === 'media') {
      // Forward audio data to OpenAI
      const audioEvent = {
        type: 'input_audio_buffer.append',
        audio: message.media.payload // Twilio sends base64 encoded audio
      };
      
      session.openAISocket.send(JSON.stringify(audioEvent));
    } else if (message.event === 'start') {
      console.log('Media stream started:', message);
    } else if (message.event === 'stop') {
      console.log('Media stream stopped');
      cleanupSession(callSid);
    }
  } catch (error) {
    console.error('Error handling Twilio message:', error);
  }
}

// Handle messages from OpenAI Real-time API
async function handleOpenAIMessage(event: MessageEvent, callSid: string) {
  try {
    const message = JSON.parse(event.data);
    const session = activeConversations.get(callSid);
    
    if (!session || !session.twilioSocket) {
      console.log('No active session found for call:', callSid);
      return;
    }

    console.log('OpenAI message type:', message.type);

    if (message.type === 'session.created') {
      console.log('OpenAI session created successfully');
    } else if (message.type === 'response.audio.delta') {
      // Forward audio response back to Twilio
      const mediaMessage = {
        event: 'media',
        streamSid: session.twilioSocket,
        media: {
          payload: message.delta // OpenAI sends base64 encoded audio
        }
      };
      
      session.twilioSocket.send(JSON.stringify(mediaMessage));
    } else if (message.type === 'conversation.item.input_audio_transcription.completed') {
      // Store user message in database
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
    } else if (message.type === 'response.text.done') {
      // Store AI response in database
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
    } else if (message.type === 'error') {
      console.error('OpenAI API error:', message.error);
    }
  } catch (error) {
    console.error('Error handling OpenAI message:', error);
  }
}

// Cleanup session when call ends
function cleanupSession(callSid: string) {
  const session = activeConversations.get(callSid);
  if (session) {
    if (session.openAISocket && session.openAISocket.readyState === WebSocket.OPEN) {
      session.openAISocket.close();
    }
    if (session.twilioSocket && session.twilioSocket.readyState === WebSocket.OPEN) {
      session.twilioSocket.close();
    }
    activeConversations.delete(callSid);
    console.log('Cleaned up session for call:', callSid);
  }
}