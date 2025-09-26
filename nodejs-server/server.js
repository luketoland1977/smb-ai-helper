import Fastify from 'fastify';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
dotenv.config();

// Retrieve environment variables
const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const PORT = process.env.PORT || 3001;

if (!OPENAI_API_KEY) {
  console.error('Missing OpenAI API key. Please set it in the .env file.');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the .env file.');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

// Search knowledge base for relevant content (including CRM data)
async function searchKnowledgeBase(clientId, query) {
  try {
    console.log('Searching knowledge base for client:', clientId, 'query:', query);
    
    // Search both chunks and documents for comprehensive results
    const { data: documents, error } = await supabase
      .from('knowledge_base_documents')
      .select('title, content, source_type, crm_record_type')
      .eq('client_id', clientId)
      .eq('processed', true)
      .textSearch('content', query.split(' ').join(' | '))
      .limit(5);

    if (error) {
      console.error('Error searching knowledge base:', error);
      return null;
    }

    if (documents && documents.length > 0) {
      const context = documents.map(doc => {
        let prefix = '';
        if (doc.source_type === 'crm') {
          prefix = `[CRM ${doc.crm_record_type?.toUpperCase() || 'RECORD'}] `;
        }
        return `${prefix}${doc.title}: ${doc.content}`;
      }).join('\n\n---\n\n');

      console.log('Found relevant knowledge base content:', documents.length, 'documents');
      return context;
    }

    console.log('No relevant knowledge base content found');
    return null;
  } catch (error) {
    console.error('Error in searchKnowledgeBase:', error);
    return null;
  }
}

// Get client and agent info from phone number
async function getClientAgentInfo(phoneNumber) {
  try {
    console.log('Looking up client/agent for phone number:', phoneNumber);
    
    const { data: integration, error } = await supabase
      .from('twilio_integrations')
      .select(`
        client_id,
        agent_id,
        voice_settings,
        clients(name),
        ai_agents(name, system_prompt)
      `)
      .eq('phone_number', phoneNumber)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error looking up integration:', error);
      return null;
    }

    console.log('Found integration:', integration);
    return integration;
  } catch (error) {
    console.error('Error getting client/agent info:', error);
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
  
  // Get the To number (the Twilio number being called)
  const toNumber = request.body?.To || request.query?.To;
  console.log('Called Twilio number:', toNumber);
  
  // Look up the integration to get greeting settings
  let greetingMessage = 'Hello! I\'m connecting you to your AI assistant.';
  let skipGreeting = false;
  let greetingVoice = 'Google.en-US-Chirp3-HD-Aoede';
  
  if (toNumber) {
    const integration = await getClientAgentInfo(toNumber);
    if (integration && integration.voice_settings) {
      const voiceSettings = integration.voice_settings;
      greetingMessage = voiceSettings.greeting_message || greetingMessage;
      skipGreeting = voiceSettings.skip_greeting || false;
      greetingVoice = voiceSettings.greeting_voice || greetingVoice;
      
      console.log('Using custom greeting settings:', {
        message: greetingMessage,
        skipGreeting,
        voice: greetingVoice
      });
    }
  }
  
  let twimlResponse;
  
  if (skipGreeting) {
    // Skip greeting and connect directly
    console.log('Skipping greeting, connecting directly to stream');
    twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                     <Response>
                         <Connect>
                             <Stream url="wss://${request.headers.host}/media-stream?phone=${encodeURIComponent(toNumber || '')}" />
                         </Connect>
                     </Response>`;
  } else {
    // Use the custom greeting with enhanced audio settings
    const audioQuality = clientInfo?.voice_settings?.audio_quality || 'enhanced';
    
    console.log('Using greeting with enhanced audio:', { greetingMessage, greetingVoice, audioQuality });
    
    // Enhanced TwiML with audio quality settings
    const audioSettings = audioQuality === 'premium' 
      ? 'audioCodec="PCMU" enableOnHold="true" statusCallback="https://webhook.example.com/status"'
      : audioQuality === 'enhanced'
      ? 'audioCodec="PCMU" enableOnHold="true"'
      : 'audioCodec="PCMU"';
    
    // Reduced delay for better user experience (was 1000ms)
    setTimeout(() => {
      console.log('Greeting delay completed');
    }, 200);
    
    twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                     <Response>
                         <Say voice="${greetingVoice}" language="en-US">${greetingMessage}</Say>
                         <Connect>
                             <Stream url="wss://${request.headers.host}/media-stream?phone=${encodeURIComponent(toNumber || '')}" ${audioSettings} />
                         </Connect>
                     </Response>`;
  }

  reply.type('text/xml').send(twimlResponse);
});

// WebSocket route for media-stream
fastify.register(async (fastify) => {
  fastify.get('/media-stream', { websocket: true }, async (connection, req) => {
    console.log('=== MEDIA STREAM WEBSOCKET CONNECTED ===');
    console.log('Request headers:', req.headers);
    console.log('Request URL:', req.url);

    // Extract phone number from query parameters
    const url = new URL(req.url, 'http://localhost');
    const phoneNumber = url.searchParams.get('phone');
    console.log('Phone number from query:', phoneNumber);

    // Get client and agent info
    let clientInfo = null;
    let systemPrompt = SYSTEM_MESSAGE;
    
    if (phoneNumber) {
      clientInfo = await getClientAgentInfo(phoneNumber);
      if (clientInfo?.ai_agents?.system_prompt) {
        systemPrompt = clientInfo.ai_agents.system_prompt;
        console.log('Using client-specific system prompt for:', clientInfo.clients?.name);
      }
    }

    // Connection-specific state
    let streamSid = null;
    let latestMediaTimestamp = 0;
    let lastAssistantItem = null;
    let markQueue = [];
    let responseStartTimestampTwilio = null;

    const openAiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    // ENHANCED AUDIO CONFIGURATION FOR OPTIMAL SOUND QUALITY
    const initializeSession = () => {
      console.log('🎯 SESSION INIT v6.0 - ENHANCED AUDIO QUALITY CONFIGURATION');
      
      // Get voice settings from client info
      const selectedVoice = clientInfo?.voice_settings?.openai_voice || 'alloy';
      const audioQuality = clientInfo?.voice_settings?.audio_quality || 'enhanced';
      const noiseSuppression = clientInfo?.voice_settings?.noise_suppression !== false;
      
      console.log('Audio settings:', { selectedVoice, audioQuality, noiseSuppression });
      
      // Enhanced VAD settings based on audio quality
      let vadSettings = {
        type: 'server_vad',
        threshold: noiseSuppression ? 0.7 : 0.65, // Higher threshold with noise suppression
        prefix_padding_ms: 500,
        silence_duration_ms: 1800
      };
      
      // Adjust settings for premium quality
      if (audioQuality === 'premium') {
        vadSettings.threshold = 0.75;
        vadSettings.prefix_padding_ms = 600;
        vadSettings.silence_duration_ms = 2000;
      } else if (audioQuality === 'standard') {
        vadSettings.threshold = 0.6;
        vadSettings.prefix_padding_ms = 400;
        vadSettings.silence_duration_ms = 1500;
      }
      
      const sessionUpdate = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: systemPrompt + (noiseSuppression ? '\n\nNote: Enhanced noise suppression is enabled for clearer audio quality.' : ''),
          voice: selectedVoice,
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: vadSettings,
          temperature: 0.8,
          max_response_output_tokens: 'inf'
        }
      };

      console.log('📤 Sending session configuration with g711_ulaw format');
      openAiWs.send(JSON.stringify(sessionUpdate));
      
      // Send initial greeting after session is configured - reduced delay
      setTimeout(async () => {
        await sendInitialConversationItem();
      }, 200);
    };

    // Send initial conversation item with knowledge base context
    const sendInitialConversationItem = async () => {
      const clientName = clientInfo?.clients?.name || 'our company';
      
      // Load essential context only once at start - reduced latency
      if (clientInfo?.client_id) {
        console.log('📚 Loading essential knowledge base context for client:', clientName);
        await injectKnowledgeBaseContext('company overview contact information', true);
      }
      
      const greeting = `Hello! I'm your AI assistant for ${clientName}. How may I help you today?`;
      
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

    // Handle knowledge base search and injection with caching
    let knowledgeCache = new Map();
    let lastKnowledgeSearch = 0;
    const KNOWLEDGE_SEARCH_COOLDOWN = 10000; // 10 seconds between searches
    
    const injectKnowledgeBaseContext = async (query, isInitial = false) => {
      if (!clientInfo?.client_id) return;
      
      // Skip if recent search unless initial
      const now = Date.now();
      if (!isInitial && (now - lastKnowledgeSearch) < KNOWLEDGE_SEARCH_COOLDOWN) {
        console.log('⏭️ Skipping knowledge base search - cooldown active');
        return;
      }
      
      // Check cache first
      if (knowledgeCache.has(query)) {
        console.log('💾 Using cached knowledge base result');
        const cachedContext = knowledgeCache.get(query);
        if (cachedContext) {
          const contextItem = {
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'system', 
              content: [
                {
                  type: 'input_text',
                  text: `Relevant company information:\n\n${cachedContext}\n\nUse this information to provide accurate responses.`
                }
              ]
            }
          };
          
          if (openAiWs.readyState === WebSocket.OPEN) {
            openAiWs.send(JSON.stringify(contextItem));
          }
        }
        return;
      }
      
      console.log('🔍 Searching knowledge base for query:', query);
      const startTime = Date.now();
      const knowledgeContext = await searchKnowledgeBase(clientInfo.client_id, query);
      const searchTime = Date.now() - startTime;
      console.log(`⏱️ Knowledge base search took ${searchTime}ms`);
      
      if (knowledgeContext) {
        // Cache the result
        knowledgeCache.set(query, knowledgeContext);
        lastKnowledgeSearch = now;
        
        console.log('📚 Injecting knowledge base context into conversation');
        const contextItem = {
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: `Relevant company information:\n\n${knowledgeContext}\n\nUse this information to provide accurate responses.`
              }
            ]
          }
        };
        
        if (openAiWs.readyState === WebSocket.OPEN) {
          openAiWs.send(JSON.stringify(contextItem));
          console.log('✅ Knowledge base context injected successfully');
        }
      } else {
        console.log('❌ No relevant knowledge base content found');
      }
    };

    // Handle user speech stopped event - reduced knowledge base calls for better performance
    let speechStopCount = 0;
    const handleSpeechStoppedEvent = async () => {
      speechStopCount++;
      console.log(`🛑 User stopped speaking (${speechStopCount}) - optimized knowledge base handling`);
      
      // Only search knowledge base on specific intervals to reduce latency
      // First stop: essential info, then every 3rd stop for additional context
      if (speechStopCount === 1) {
        await injectKnowledgeBaseContext('frequently asked questions FAQ support');
      } else if (speechStopCount % 3 === 0) {
        await injectKnowledgeBaseContext('services products pricing features');
      } else {
        console.log('⏭️ Skipping knowledge base search for better response time');
      }
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
    openAiWs.on('message', async (data) => {
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

        if (response.type === 'input_audio_buffer.speech_stopped') {
          console.log('🛑 User stopped speaking - optimized handling');
          await handleSpeechStoppedEvent();
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
    connection.on('message', async (message) => {
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

    // Handle connection errors
    connection.on('error', (error) => {
      console.error('WebSocket connection error:', error);
      if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
    });

    // Handle WebSocket close and errors
    openAiWs.on('close', () => {
      console.log('Disconnected from the OpenAI Realtime API');
    });

    openAiWs.on('error', (error) => {
      console.error('Error in the OpenAI WebSocket:', error);
      // Don't crash the server on WebSocket errors
      if (connection && connection.readyState === connection.OPEN) {
        connection.close();
      }
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