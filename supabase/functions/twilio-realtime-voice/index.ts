import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import "https://deno.land/x/xhr@0.1.0/mod.ts";

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Store active sessions with proper typing
interface ActiveSession {
  openAISocket: WebSocket | null;
  conversationId: string;
  agentConfig: {
    agent: any;
    clientId: string;
  };
  twilioSocket: WebSocket | null;
  callSid: string;
  isConnected: boolean;
}

const activeSessions = new Map<string, ActiveSession>();

// Audio encoding utilities
function encodeAudioForOpenAI(base64Audio: string): string {
  try {
    // Twilio sends mulaw encoded audio, we need to convert to PCM16
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Convert mulaw to PCM16 (simplified conversion)
    const pcm16Array = new Int16Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      // Mulaw to linear conversion (simplified)
      const mulaw = bytes[i];
      const sign = (mulaw & 0x80) >> 7;
      const exponent = (mulaw & 0x70) >> 4;
      const mantissa = mulaw & 0x0F;
      
      let sample = (33 + 2 * mantissa) << (exponent + 2);
      if (sample > 32767) sample = 32767;
      if (sign) sample = -sample;
      
      pcm16Array[i] = sample;
    }
    
    // Convert to base64
    const uint8Array = new Uint8Array(pcm16Array.buffer);
    let binary = '';
    const chunkSize = 0x8000;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  } catch (error) {
    console.error('Error encoding audio for OpenAI:', error);
    return base64Audio; // fallback to original
  }
}

function encodeAudioForTwilio(base64Audio: string): string {
  try {
    // OpenAI sends PCM16, convert to mulaw for Twilio
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const int16Array = new Int16Array(bytes.buffer);
    const mulawArray = new Uint8Array(int16Array.length);
    
    for (let i = 0; i < int16Array.length; i++) {
      let sample = int16Array[i];
      
      // Linear to mulaw conversion (simplified)
      const sign = sample < 0 ? 0x80 : 0x00;
      if (sample < 0) sample = -sample;
      
      sample = Math.min(sample, 32635);
      sample += 132;
      
      let exponent = 7;
      for (let exp = 0; exp < 8; exp++) {
        if (sample <= (33 << (exp + 2))) {
          exponent = exp;
          break;
        }
      }
      
      const mantissa = (sample >> (exponent + 3)) & 0x0F;
      mulawArray[i] = sign | (exponent << 4) | mantissa;
    }
    
    // Convert to base64
    let binary = '';
    const chunkSize = 0x8000;
    
    for (let i = 0; i < mulawArray.length; i += chunkSize) {
      const chunk = mulawArray.subarray(i, Math.min(i + chunkSize, mulawArray.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  } catch (error) {
    console.error('Error encoding audio for Twilio:', error);
    return base64Audio; // fallback to original
  }
}

serve(async (req) => {
  console.log('=== TWILIO REALTIME VOICE FUNCTION ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log('Non-WebSocket request, returning 400');
    return new Response("This endpoint expects WebSocket connections only", { status: 400 });
  }

  const url = new URL(req.url);
  const callSid = url.searchParams.get('callSid');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  console.log('WebSocket upgrade request params:', { callSid, from, to });

  if (!callSid || !from || !to) {
    console.error('Missing required parameters');
    return new Response("Missing required parameters: callSid, from, to", { status: 400 });
  }

  try {
    const { socket, response } = Deno.upgradeWebSocket(req);
    console.log('WebSocket upgrade successful for call:', callSid);

    socket.onopen = async () => {
      console.log('Twilio WebSocket connection opened for call:', callSid);
      await initializeRealtimeSession(socket, { callSid, from, to });
    };

    socket.onmessage = async (event) => {
      try {
        await handleTwilioMessage(event, callSid);
      } catch (error) {
        console.error('Error handling Twilio message:', error);
      }
    };

    socket.onclose = (event) => {
      console.log('Twilio WebSocket closed for call:', callSid, 'Code:', event.code, 'Reason:', event.reason);
      cleanupSession(callSid);
    };

    socket.onerror = (error) => {
      console.error('Twilio WebSocket error for call:', callSid, error);
      cleanupSession(callSid);
    };

    return response;
  } catch (error) {
    console.error('Error upgrading to WebSocket:', error);
    return new Response("Failed to upgrade to WebSocket", { status: 500 });
  }
});

async function initializeRealtimeSession(twilioSocket: WebSocket, params: { callSid: string, from: string, to: string }) {
  const { callSid, from, to } = params;
  
  try {
    console.log('Initializing realtime session for call:', callSid);
    
    // Find Twilio integration
    const phoneFormats = [
      to,
      to.replace(/\D/g, ''),
      `+1 ${to.slice(2, 5)} ${to.slice(5, 8)} ${to.slice(8)}`,
      `+${to.slice(1, 2)} ${to.slice(2, 5)} ${to.slice(5, 8)} ${to.slice(8)}`
    ];
    
    console.log('Looking for Twilio integration with phone formats:', phoneFormats);
    
    const { data: twilioIntegration, error: twilioError } = await supabase
      .from('twilio_integrations')
      .select('*')
      .in('phone_number', phoneFormats)
      .eq('is_active', true)
      .eq('voice_enabled', true)
      .single();

    if (twilioError || !twilioIntegration) {
      console.error('No Twilio integration found:', twilioError);
      twilioSocket.close(1008, 'No integration found');
      return;
    }

    console.log('Found Twilio integration:', twilioIntegration.id);

    // Get agent details
    const { data: agent, error: agentError } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', twilioIntegration.agent_id)
      .single();

    if (agentError || !agent) {
      console.error('No agent found:', agentError);
      twilioSocket.close(1008, 'No agent configured');
      return;
    }

    console.log('Found agent:', agent.id, agent.name);

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
        metadata: { call_sid: callSid, real_time: true, session_type: 'realtime_voice' }
      })
      .select('id')
      .single();

    if (convError || !conversation) {
      console.error('Failed to create conversation:', convError);
      twilioSocket.close(1011, 'Database error');
      return;
    }

    console.log('Created conversation:', conversation.id);

    // Initialize session object
    const session: ActiveSession = {
      openAISocket: null,
      conversationId: conversation.id,
      agentConfig: { agent, clientId: twilioIntegration.client_id },
      twilioSocket,
      callSid,
      isConnected: false
    };

    activeSessions.set(callSid, session);

    // Connect to OpenAI Realtime API
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('OpenAI API key not configured');
      twilioSocket.close(1011, 'API key not configured');
      return;
    }

    console.log('Connecting to OpenAI Realtime API...');
    
    const openAISocket = new WebSocket(
      'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
      {
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      }
    );

    session.openAISocket = openAISocket;

    // Setup OpenAI WebSocket handlers
    openAISocket.onopen = () => {
      console.log('OpenAI WebSocket connected for call:', callSid);
      session.isConnected = true;
      
      // Send session configuration
      const sessionConfig = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: agent.system_prompt || `You are a helpful AI customer service agent. You assist customers with their inquiries in a friendly and professional manner via phone calls.

Guidelines:
- Keep responses conversational and natural for voice
- Be polite and helpful  
- Provide accurate information
- Ask clarifying questions when needed
- Speak clearly and at a moderate pace
- If the conversation seems complete, offer to help with anything else or say goodbye`,
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
      
      console.log('Sending session configuration to OpenAI');
      openAISocket.send(JSON.stringify(sessionConfig));
    };

    openAISocket.onmessage = async (event) => {
      try {
        await handleOpenAIMessage(event, callSid);
      } catch (error) {
        console.error('Error handling OpenAI message:', error);
      }
    };

    openAISocket.onclose = (event) => {
      console.log('OpenAI WebSocket closed for call:', callSid, 'Code:', event.code);
      session.isConnected = false;
      cleanupSession(callSid);
    };

    openAISocket.onerror = (error) => {
      console.error('OpenAI WebSocket error for call:', callSid, error);
      session.isConnected = false;
      cleanupSession(callSid);
    };

  } catch (error) {
    console.error('Error initializing realtime session:', error);
    twilioSocket.close(1011, 'Initialization failed');
    cleanupSession(callSid);
  }
}

async function handleTwilioMessage(event: MessageEvent, callSid: string) {
  const session = activeSessions.get(callSid);
  if (!session) {
    console.log('No session found for call:', callSid);
    return;
  }

  try {
    const message = JSON.parse(event.data);
    console.log('Twilio message event:', message.event, 'for call:', callSid);

    switch (message.event) {
      case 'connected':
        console.log('Twilio media stream connected');
        break;
        
      case 'start':
        console.log('Twilio media stream started:', message.start);
        break;
        
      case 'media':
        if (session.openAISocket?.readyState === WebSocket.OPEN && session.isConnected) {
          // Encode audio for OpenAI
          const encodedAudio = encodeAudioForOpenAI(message.media.payload);
          
          const audioEvent = {
            type: 'input_audio_buffer.append',
            audio: encodedAudio
          };
          
          session.openAISocket.send(JSON.stringify(audioEvent));
        }
        break;
        
      case 'stop':
        console.log('Twilio media stream stopped');
        cleanupSession(callSid);
        break;
        
      default:
        console.log('Unknown Twilio event:', message.event);
    }
  } catch (error) {
    console.error('Error parsing Twilio message:', error);
  }
}

async function handleOpenAIMessage(event: MessageEvent, callSid: string) {
  const session = activeSessions.get(callSid);
  if (!session) {
    console.log('No session found for OpenAI message, call:', callSid);
    return;
  }

  try {
    const message = JSON.parse(event.data);
    console.log('OpenAI message type:', message.type, 'for call:', callSid);

    switch (message.type) {
      case 'session.created':
        console.log('OpenAI session created successfully');
        break;
        
      case 'session.updated':
        console.log('OpenAI session updated successfully');
        break;
        
      case 'response.audio.delta':
        // Stream audio back to Twilio
        if (session.twilioSocket?.readyState === WebSocket.OPEN) {
          const encodedAudio = encodeAudioForTwilio(message.delta);
          
          const mediaMessage = {
            event: 'media',
            streamSid: session.callSid,
            media: {
              payload: encodedAudio
            }
          };
          
          session.twilioSocket.send(JSON.stringify(mediaMessage));
        }
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        // Store user message
        if (message.transcript) {
          console.log('User transcript:', message.transcript);
          await supabase
            .from('messages')
            .insert({
              conversation_id: session.conversationId,
              role: 'user',
              content: message.transcript,
              metadata: { 
                channel: 'voice', 
                call_sid: callSid, 
                real_time: true,
                message_id: message.item_id 
              }
            });
        }
        break;
        
      case 'response.text.done':
        // Store AI response
        if (message.text) {
          console.log('AI response text:', message.text);
          await supabase
            .from('messages')
            .insert({
              conversation_id: session.conversationId,
              role: 'assistant',
              content: message.text,
              metadata: { 
                channel: 'voice', 
                call_sid: callSid, 
                real_time: true,
                response_id: message.response_id 
              }
            });
        }
        break;
        
      case 'error':
        console.error('OpenAI API error:', message.error);
        break;
        
      default:
        // Log other message types for debugging
        if (message.type?.includes('error')) {
          console.error('OpenAI error message:', message);
        }
    }
  } catch (error) {
    console.error('Error parsing OpenAI message:', error);
  }
}

function cleanupSession(callSid: string) {
  const session = activeSessions.get(callSid);
  if (session) {
    console.log('Cleaning up session for call:', callSid);
    
    if (session.openAISocket?.readyState === WebSocket.OPEN) {
      session.openAISocket.close();
    }
    
    if (session.twilioSocket?.readyState === WebSocket.OPEN) {
      session.twilioSocket.close();
    }
    
    activeSessions.delete(callSid);
    console.log('Session cleanup completed for call:', callSid);
  }
}