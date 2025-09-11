import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Active sessions to track ongoing calls
interface ActiveSession {
  twilioSocket: WebSocket;
  openAISocket: WebSocket | null;
  conversationId: string;
  agentId: string;
  clientId: string;
  callSid: string;
}

const activeSessions = new Map<string, ActiveSession>();

// Audio encoding utilities
function encodeAudioForOpenAI(base64Audio: string): string {
  // Twilio sends audio as Mulaw encoded, need to convert to PCM16 for OpenAI
  try {
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Convert Mulaw to PCM16 (simplified conversion)
    const pcm16 = new Int16Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      // Basic Mulaw to linear conversion (simplified)
      let mulaw = bytes[i];
      let sign = (mulaw & 0x80) ? -1 : 1;
      mulaw &= 0x7F;
      let exp = (mulaw >> 4) & 0x07;
      let mantissa = mulaw & 0x0F;
      let sample = (mantissa << 1) + 0x21;
      sample = sample << (exp + 7);
      pcm16[i] = sign * sample;
    }
    
    // Convert to base64
    const uint8Array = new Uint8Array(pcm16.buffer);
    let binary = '';
    const chunkSize = 0x8000;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  } catch (error) {
    console.error('Error encoding audio for OpenAI:', error);
    return base64Audio; // Return original if conversion fails
  }
}

function encodeAudioForTwilio(base64Audio: string): string {
  // OpenAI sends PCM16, need to convert to Mulaw for Twilio
  try {
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Convert bytes to PCM16
    const pcm16 = new Int16Array(bytes.buffer);
    
    // Convert PCM16 to Mulaw (simplified conversion)
    const mulaw = new Uint8Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      let sample = pcm16[i];
      let sign = sample < 0 ? 0x80 : 0;
      if (sample < 0) sample = -sample;
      
      let exp = 0;
      let mantissa = 0;
      
      if (sample >= 0x8000) {
        sample = 0x7FFF;
      }
      
      if (sample >= 0x1000) {
        exp = 7;
        mantissa = (sample >> 8) & 0x0F;
      } else if (sample >= 0x800) {
        exp = 6;
        mantissa = (sample >> 7) & 0x0F;
      } else if (sample >= 0x400) {
        exp = 5;
        mantissa = (sample >> 6) & 0x0F;
      } else if (sample >= 0x200) {
        exp = 4;
        mantissa = (sample >> 5) & 0x0F;
      } else if (sample >= 0x100) {
        exp = 3;
        mantissa = (sample >> 4) & 0x0F;
      } else if (sample >= 0x80) {
        exp = 2;
        mantissa = (sample >> 3) & 0x0F;
      } else if (sample >= 0x40) {
        exp = 1;
        mantissa = (sample >> 2) & 0x0F;
      } else {
        exp = 0;
        mantissa = (sample >> 1) & 0x0F;
      }
      
      mulaw[i] = sign | (exp << 4) | mantissa;
    }
    
    // Convert to base64
    let binary = '';
    const chunkSize = 0x8000;
    
    for (let i = 0; i < mulaw.length; i += chunkSize) {
      const chunk = mulaw.subarray(i, Math.min(i + chunkSize, mulaw.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  } catch (error) {
    console.error('Error encoding audio for Twilio:', error);
    return base64Audio; // Return original if conversion fails
  }
}

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log('Non-WebSocket request received');
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  console.log('WebSocket upgrade request received');
  
  // Extract parameters from URL
  const url = new URL(req.url);
  const callSid = url.searchParams.get('callSid');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  if (!callSid || !from || !to) {
    console.error('Missing required parameters:', { callSid, from, to });
    return new Response("Missing required parameters", { status: 400 });
  }

  console.log('WebSocket parameters:', { callSid, from, to });

  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = () => {
    console.log('Twilio WebSocket connection opened for call:', callSid);
    // Send start message to indicate we're ready to receive media
    const startMessage = {
      event: 'start',
      start: {
        streamSid: callSid
      }
    };
    socket.send(JSON.stringify(startMessage));
    initializeRealtimeSession(socket, { callSid, from, to });
  };

  socket.onmessage = (event) => {
    handleTwilioMessage(event, callSid);
  };

  socket.onclose = () => {
    console.log('Twilio WebSocket connection closed for call:', callSid);
    cleanupSession(callSid);
  };

  socket.onerror = (error) => {
    console.error('Twilio WebSocket error for call:', callSid, error);
    cleanupSession(callSid);
  };

  return response;
});

async function initializeRealtimeSession(twilioSocket: WebSocket, params: { callSid: string, from: string, to: string }): Promise<void> {
  const { callSid, from, to } = params;
  
  try {
    console.log('Initializing real-time session for call:', callSid);
    
    // Find Twilio integration and agent
    const phoneFormats = [
      to,
      to.replace(/\D/g, ''),
      `(${to.slice(2, 5)}) ${to.slice(5, 8)}-${to.slice(8)}`,
      `+1 ${to.slice(2, 5)} ${to.slice(5, 8)} ${to.slice(8)}`,
      `${to.slice(2, 5)}-${to.slice(5, 8)}-${to.slice(8)}`,
      `${to.slice(2, 5)}.${to.slice(5, 8)}.${to.slice(8)}`
    ];

    const { data: twilioIntegration, error: twilioError } = await supabase
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
      .in('phone_number', phoneFormats)
      .eq('is_active', true)
      .eq('voice_enabled', true)
      .single();

    if (twilioError || !twilioIntegration) {
      console.error('No Twilio integration found:', twilioError);
      twilioSocket.close(1000, 'No integration found');
      return;
    }

    const agent = twilioIntegration.ai_agents;
    if (!agent) {
      console.error('No agent found for integration');
      twilioSocket.close(1000, 'No agent configured');
      return;
    }

    // Create conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        client_id: twilioIntegration.client_id,
        agent_id: agent.id,
        communication_channel: 'voice_realtime',
        phone_number: from,
        twilio_session_id: callSid,
        status: 'active',
        metadata: { call_sid: callSid, realtime: true }
      })
      .select('id')
      .single();

    if (convError || !conversation) {
      console.error('Failed to create conversation:', convError);
      twilioSocket.close(1000, 'Failed to create conversation');
      return;
    }

    console.log('Conversation created:', conversation.id);

    // Get OpenAI API key
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('OpenAI API key not configured');
      twilioSocket.close(1000, 'API key not configured');
      return;
    }

    // Connect directly to OpenAI Realtime API
    const openAISocket = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    console.log('Connecting to OpenAI Realtime API...');

    openAISocket.onopen = () => {
      console.log('OpenAI WebSocket connection opened for call:', callSid);
      // Session will be configured when session.created event is received
    };

    openAISocket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('OpenAI message type:', data.type);

        if (data.type === 'session.created') {
          console.log('OpenAI session created, sending configuration...');
          
          // Configure session after connection
          const voiceSettings = twilioIntegration.voice_settings || { voice: 'alloy' };
          const systemPrompt = agent.system_prompt || `You are a helpful AI customer service agent conducting a phone conversation. 

Guidelines:
- Keep responses natural and conversational for voice
- Be polite, professional, and helpful
- Listen carefully and respond appropriately
- Keep responses concise but complete
- Ask clarifying questions when needed
- If the conversation seems complete, offer to help with anything else or say goodbye

You are speaking directly with a customer over the phone right now.`;

          // Get welcome message
          let welcomeMessage = "Hello! How can I help you today?";
          if (voiceSettings.welcome_message) {
            welcomeMessage = voiceSettings.welcome_message;
          } else if (agent.settings?.welcome_message) {
            welcomeMessage = agent.settings.welcome_message;
          } else if (agent.name) {
            welcomeMessage = `Hello! I'm ${agent.name}. How can I help you today?`;
          }

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

          console.log('Sending session configuration to OpenAI');
          openAISocket.send(JSON.stringify(sessionConfig));

          // Send initial greeting
          setTimeout(() => {
            const greetingEvent = {
              type: 'conversation.item.create',
              item: {
                type: 'message',
                role: 'assistant',
                content: [
                  {
                    type: 'input_text',
                    text: welcomeMessage
                  }
                ]
              }
            };
            
            openAISocket.send(JSON.stringify(greetingEvent));
            openAISocket.send(JSON.stringify({ type: 'response.create' }));
            console.log('Sent initial greeting to OpenAI');
          }, 100);
        } else {
          handleOpenAIMessage(event, callSid);
        }
      } catch (error) {
        console.error('Error processing OpenAI message:', error);
      }
    };

    openAISocket.onclose = () => {
      console.log('OpenAI WebSocket connection closed for call:', callSid);
      cleanupSession(callSid);
    };

    openAISocket.onerror = (error) => {
      console.error('OpenAI WebSocket error for call:', callSid, error);
      cleanupSession(callSid);
    };

    // Store active session
    activeSessions.set(callSid, {
      twilioSocket,
      openAISocket,
      conversationId: conversation.id,
      agentId: agent.id,
      clientId: twilioIntegration.client_id,
      callSid
    });

    console.log('Real-time session initialized for call:', callSid);

  } catch (error) {
    console.error('Error initializing real-time session:', error);
    twilioSocket.close(1000, 'Initialization failed');
  }
}

async function handleTwilioMessage(event: MessageEvent, callSid: string): Promise<void> {
  try {
    const session = activeSessions.get(callSid);
    if (!session || !session.openAISocket) {
      console.log('No active session or OpenAI socket for call:', callSid);
      return;
    }

    const message = JSON.parse(event.data);
    console.log('Received message from Twilio:', message.event);

    if (message.event === 'media') {
      // Forward audio to OpenAI
      const encodedAudio = encodeAudioForOpenAI(message.media.payload);
      
      const audioEvent = {
        type: 'input_audio_buffer.append',
        audio: encodedAudio
      };

      session.openAISocket.send(JSON.stringify(audioEvent));
    } else if (message.event === 'stop') {
      console.log('Call ended by Twilio for call:', callSid);
      cleanupSession(callSid);
    }

  } catch (error) {
    console.error('Error handling Twilio message:', error);
  }
}

async function handleOpenAIMessage(event: MessageEvent, callSid: string): Promise<void> {
  try {
    const session = activeSessions.get(callSid);
    if (!session) {
      console.log('No active session for call:', callSid);
      return;
    }

    const data = JSON.parse(event.data);
    console.log('Received message from OpenAI:', data.type);

    if (data.type === 'session.created') {
      console.log('OpenAI session created for call:', callSid);
    } else if (data.type === 'session.updated') {
      console.log('OpenAI session updated for call:', callSid);
    } else if (data.type === 'response.audio.delta') {
      // Stream audio back to Twilio
      const encodedAudio = encodeAudioForTwilio(data.delta);
      
      const mediaMessage = {
        event: 'media',
        streamSid: callSid,
        media: {
          payload: encodedAudio
        }
      };

      session.twilioSocket.send(JSON.stringify(mediaMessage));
    } else if (data.type === 'input_audio_buffer.speech_started') {
      console.log('User started speaking on call:', callSid);
      // Send mark to Twilio to stop any ongoing audio
      const markMessage = {
        event: 'mark',
        streamSid: callSid,
        mark: {
          name: 'speech_started'
        }
      };
      session.twilioSocket.send(JSON.stringify(markMessage));
    } else if (data.type === 'conversation.item.input_audio_transcription.completed') {
      // Store user transcription
      if (data.transcript) {
        await supabase
          .from('messages')
          .insert({
            conversation_id: session.conversationId,
            role: 'user',
            content: data.transcript,
            metadata: { 
              call_sid: callSid, 
              phone_number: session.twilioSocket.url,
              type: 'voice_transcription'
            }
          });
        console.log('Stored user transcription for call:', callSid);
      }
    } else if (data.type === 'response.audio_transcript.delta') {
      // Store AI response transcript (accumulate deltas)
      console.log('AI response transcript delta:', data.delta);
    } else if (data.type === 'response.audio_transcript.done') {
      // Store complete AI response
      if (data.transcript) {
        await supabase
          .from('messages')
          .insert({
            conversation_id: session.conversationId,
            role: 'assistant',
            content: data.transcript,
            metadata: { 
              call_sid: callSid,
              type: 'voice_response'
            }
          });
        console.log('Stored AI response transcript for call:', callSid);
      }
    } else if (data.type === 'error') {
      console.error('OpenAI API error for call:', callSid, data.error);
    }

  } catch (error) {
    console.error('Error handling OpenAI message:', error);
  }
}

function cleanupSession(callSid: string): void {
  console.log('Cleaning up session for call:', callSid);
  
  const session = activeSessions.get(callSid);
  if (session) {
    try {
      if (session.twilioSocket && session.twilioSocket.readyState === WebSocket.OPEN) {
        session.twilioSocket.close();
      }
    } catch (error) {
      console.error('Error closing Twilio socket:', error);
    }

    try {
      if (session.openAISocket && session.openAISocket.readyState === WebSocket.OPEN) {
        session.openAISocket.close();
      }
    } catch (error) {
      console.error('Error closing OpenAI socket:', error);
    }

    activeSessions.delete(callSid);
    console.log('Session cleaned up for call:', callSid);
  }
}