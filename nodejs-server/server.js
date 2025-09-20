import Fastify from 'fastify';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
dotenv.config();

// Retrieve the OpenAI API key from environment variables.
const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const PORT = process.env.PORT || 3001;

if (!OPENAI_API_KEY) {
  console.error('Missing OpenAI API key. Please set it in the .env file.');
  process.exit(1);
}

// Initialize Supabase client
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Initialize Fastify
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Constants
const SYSTEM_MESSAGE = 'You are a helpful and bubbly AI assistant who loves to chat about anything the user is interested about and is prepared to offer them facts. You have a penchant for dad jokes, owl jokes, and rickrolling – subtly. Always stay positive, but work in a joke when appropriate.';
const VOICE = 'alloy';
const TEMPERATURE = 0.8;

// List of Event Types to log to the console
const LOG_EVENT_TYPES = [
  'error',
  'response.content.done',
  'rate_limits.updated',
  'response.done',
  'input_audio_buffer.committed',
  'input_audio_buffer.speech_stopped',
  'input_audio_buffer.speech_started',
  'session.created',
  'session.updated'
];

// Show AI response elapsed timing calculations
const SHOW_TIMING_MATH = false;

// Search knowledge base for relevant content
async function searchKnowledgeBase(clientId, query) {
  if (!supabase || !clientId || !query) {
    return null;
  }

  try {
    console.log('🔍 Searching knowledge base for client:', clientId, 'query:', query);
    
    // Search for relevant chunks using text similarity
    const { data: chunks, error } = await supabase
      .from('knowledge_base_chunks')
      .select('content, metadata')
      .eq('client_id', clientId)
      .textSearch('content', query.split(' ').join(' | '))
      .limit(3);

    if (error) {
      console.error('❌ Knowledge base search error:', error);
      return null;
    }

    if (!chunks || chunks.length === 0) {
      console.log('📄 No relevant knowledge base content found');
      return null;
    }

    // Combine relevant chunks into context
    const context = chunks
      .map(chunk => chunk.content)
      .join('\n\n---\n\n');

    console.log('✅ Found relevant knowledge base content:', chunks.length, 'chunks');
    return context;
  } catch (error) {
    console.error('❌ Error searching knowledge base:', error);
    return null;
  }
}

// Get client ID from phone number or session data
async function getClientIdFromPhone(phoneNumber) {
  if (!supabase || !phoneNumber) {
    return null;
  }

  try {
    // Look up client ID from Twilio integrations table using phone number
    const { data, error } = await supabase
      .from('twilio_integrations')
      .select('client_id')
      .eq('phone_number', phoneNumber)
      .single();

    if (error) {
      console.log('📞 No client found for phone number:', phoneNumber);
      return null;
    }

    console.log('📞 Found client ID for phone:', phoneNumber, 'client:', data.client_id);
    return data.client_id;
  } catch (error) {
    console.error('❌ Error looking up client ID:', error);
    return null;
  }
}

// Root Route
fastify.get('/', async (request, reply) => {
  reply.send({ message: 'Twilio Media Stream Server v4.0 - Session Fixed!', timestamp: new Date().toISOString() });
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  reply.send({ status: 'healthy', timestamp: new Date().toISOString() });
});


// Route for Twilio to handle incoming calls
fastify.all('/incoming-call', async (request, reply) => {
  console.log('=== INCOMING CALL RECEIVED ===');
  console.log('Headers:', request.headers);
  console.log('Body:', request.body);
  console.log('Host:', request.headers.host);
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                        <Response>
                            <Say voice="Google.en-US-Chirp3-HD-Aoede">Hello! I'm your AI assistant. How can I help you today?</Say>
                            <Connect>
                                <Stream url="wss://${request.headers.host}/media-stream" />
                            </Connect>
                        </Response>`;

  reply.type('text/xml').send(twimlResponse);
});

// WebSocket route for media-stream
fastify.register(async (fastify) => {
  fastify.get('/media-stream', { websocket: true }, (connection, req) => {
    console.log('=== MEDIA STREAM WEBSOCKET CONNECTED ===');
    console.log('Request headers:', req.headers);

    // Connection-specific state
    let streamSid = null;
    let latestMediaTimestamp = 0;
    let lastAssistantItem = null;
    let markQueue = [];
    let responseStartTimestampTwilio = null;
    let clientId = null;
    let currentTranscription = '';
    let knowledgeContext = null;

    const openAiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    // FIXED AUDIO FORMAT CONFIGURATION FOR TWILIO COMPATIBILITY
    const initializeSession = () => {
      console.log('🎯 SESSION INIT v5.0 - CONFIGURING AUDIO FORMATS FOR TWILIO');
      
      const sessionUpdate = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: 'pmpt_68c50f2852548197b42ccce02443ea1804c7524836544f5a',
          voice: 'alloy',
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
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

      console.log('📤 Sending session configuration with g711_ulaw format');
      openAiWs.send(JSON.stringify(sessionUpdate));
      
      // Send initial greeting after session is configured
      setTimeout(() => {
        sendInitialConversationItem();
      }, 1000);
    };

    // Send initial conversation item so AI speaks first
    const sendInitialConversationItem = () => {
      const greeting = 'Hello! How may I assist you today?';
      
      const initialConversationItem = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `Greet the user with "${greeting}"`
            }
          ]
        }
      };

      if (SHOW_TIMING_MATH) console.log('Sending initial conversation item:', JSON.stringify(initialConversationItem));
      openAiWs.send(JSON.stringify(initialConversationItem));
      openAiWs.send(JSON.stringify({ type: 'response.create' }));
    };

    // Handle interruption when the caller's speech starts
    const handleSpeechStartedEvent = () => {
      if (markQueue.length > 0 && responseStartTimestampTwilio != null) {
        const elapsedTime = latestMediaTimestamp - responseStartTimestampTwilio;
        if (SHOW_TIMING_MATH) console.log(`Calculating elapsed time for truncation: ${latestMediaTimestamp} - ${responseStartTimestampTwilio} = ${elapsedTime}ms`);

        if (lastAssistantItem) {
          const truncateEvent = {
            type: 'conversation.item.truncate',
            item_id: lastAssistantItem,
            content_index: 0,
            audio_end_ms: elapsedTime
          };
          if (SHOW_TIMING_MATH) console.log('Sending truncation event:', JSON.stringify(truncateEvent));
          openAiWs.send(JSON.stringify(truncateEvent));
        }

        connection.send(JSON.stringify({
          event: 'clear',
          streamSid: streamSid
        }));

        // Reset
        markQueue = [];
        lastAssistantItem = null;
        responseStartTimestampTwilio = null;
      }
    };

    // Send mark messages to Media Streams so we know if and when AI response playback is finished
    const sendMark = (connection, streamSid) => {
      if (streamSid) {
        const markEvent = {
          event: 'mark',
          streamSid: streamSid,
          mark: { name: 'responsePart' }
        };
        connection.send(JSON.stringify(markEvent));
        markQueue.push('responsePart');
      }
    };

    // Open event for OpenAI WebSocket
    openAiWs.on('open', () => {
      console.log('Connected to the OpenAI Realtime API');
      setTimeout(initializeSession, 100);
    });

    // Listen for messages from the OpenAI WebSocket (and send to Twilio if necessary)
    openAiWs.on('message', (data) => {
      try {
        const response = JSON.parse(data);

        console.log(`📥 OpenAI Event: ${response.type}`, {
          type: response.type,
          hasAudio: Boolean(response.delta),
          itemId: response.item_id,
          timestamp: new Date().toISOString()
        });

        if (LOG_EVENT_TYPES.includes(response.type)) {
          console.log(`Received event: ${response.type}`, response);
        }

        if (response.type === 'response.audio.delta' && response.delta) {
          console.log(`🎵 Sending audio delta to Twilio, length: ${response.delta.length}`);
          
          const audioDelta = {
            event: 'media',
            streamSid: streamSid,
            media: { payload: response.delta }
          };
          connection.send(JSON.stringify(audioDelta));

          // First delta from a new response starts the elapsed time counter
          if (!responseStartTimestampTwilio) {
            responseStartTimestampTwilio = latestMediaTimestamp;
            console.log(`⏱️ Starting response timer at: ${responseStartTimestampTwilio}ms`);
            if (SHOW_TIMING_MATH) console.log(`Setting start timestamp for new response: ${responseStartTimestampTwilio}ms`);
          }

          if (response.item_id) {
            lastAssistantItem = response.item_id;
          }
          
          sendMark(connection, streamSid);
        }

        if (response.type === 'input_audio_buffer.speech_started') {
          console.log('🎤 User started speaking - handling interruption');
          handleSpeechStartedEvent();
        }

        // Handle transcription for knowledge base search
        if (response.type === 'conversation.item.input_audio_transcription.completed') {
          const transcribedText = response.transcript;
          console.log('📝 Transcription completed:', transcribedText);
          
          if (transcribedText && clientId) {
            // Search knowledge base with transcribed text
            searchKnowledgeBase(clientId, transcribedText).then((context) => {
              if (context) {
                knowledgeContext = context;
                console.log('📚 Updated knowledge context for next response');
                
                // Update session with enhanced instructions including knowledge base context
                const enhancedInstructions = `pmpt_68c50f2852548197b42ccce02443ea1804c7524836544f5a

Additional relevant information from knowledge base:
${context}

Please use this information to provide accurate, helpful responses when relevant to the user's question.`;

                const sessionUpdate = {
                  type: 'session.update',
                  session: {
                    instructions: enhancedInstructions
                  }
                };
                
                openAiWs.send(JSON.stringify(sessionUpdate));
                console.log('🔄 Updated session with knowledge base context');
              }
            }).catch(error => {
              console.error('❌ Error updating knowledge context:', error);
            });
          }
        }

        if (response.type === 'response.created') {
          console.log('🤖 OpenAI response started');
        }

        if (response.type === 'response.done') {
          console.log('✅ OpenAI response completed', {
            status: response.response?.status,
            output_count: response.response?.output?.length || 0
          });
        }
      } catch (error) {
        console.error('Error processing OpenAI message:', error, 'Raw message:', data);
      }
    });

    // Handle incoming messages from Twilio
    connection.on('message', (message) => {
      try {
        const data = JSON.parse(message);

        switch (data.event) {
          case 'media':
            latestMediaTimestamp = data.media.timestamp;
            console.log(`🎙️ Received audio from Twilio, timestamp: ${latestMediaTimestamp}ms`);
            if (SHOW_TIMING_MATH) console.log(`Received media message with timestamp: ${latestMediaTimestamp}ms`);
            if (openAiWs.readyState === WebSocket.OPEN) {
              const audioAppend = {
                type: 'input_audio_buffer.append',
                audio: data.media.payload
              };
              openAiWs.send(JSON.stringify(audioAppend));
              console.log(`📤 Sent audio to OpenAI, payload length: ${data.media.payload.length}`);
            } else {
              console.log('⚠️ OpenAI WebSocket not ready, dropping audio');
            }
            break;
          case 'start':
            streamSid = data.start.streamSid;
            console.log('Incoming stream has started', streamSid);

            // Try to get client ID from incoming call metadata
            // Extract phone number from custom parameters if available
            const callerNumber = data.start.customParameters?.From || data.start.customParameters?.from;
            if (callerNumber) {
              console.log('📞 Extracting client ID for caller:', callerNumber);
              getClientIdFromPhone(callerNumber).then((foundClientId) => {
                if (foundClientId) {
                  clientId = foundClientId;
                  console.log('✅ Client ID set for knowledge base:', clientId);
                } else {
                  console.log('📞 No client mapping found for phone number');
                }
              }).catch(error => {
                console.error('❌ Error getting client ID:', error);
              });
            }

            // Reset start and media timestamp on a new stream
            responseStartTimestampTwilio = null; 
            latestMediaTimestamp = 0;
            break;
          case 'mark':
            if (markQueue.length > 0) {
              markQueue.shift();
            }
            break;
          default:
            console.log('Received non-media event:', data.event);
            break;
        }
      } catch (error) {
        console.error('Error parsing message:', error, 'Message:', message);
      }
    });

    // Handle connection close
    connection.on('close', () => {
      if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
      console.log('Client disconnected.');
    });

    // Handle WebSocket close and errors
    openAiWs.on('close', () => {
      console.log('Disconnected from the OpenAI Realtime API');
    });

    openAiWs.on('error', (error) => {
      console.error('Error in the OpenAI WebSocket:', error);
    });
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  fastify.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`💥💥💥 ULTIMATE SESSION FIX v3.0.0 DEPLOYED - Server on port ${PORT} 💥💥💥`);
});