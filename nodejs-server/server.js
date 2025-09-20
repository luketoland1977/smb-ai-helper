import Fastify from 'fastify';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';

// Load environment variables from .env file
dotenv.config();

// Retrieve the OpenAI API key from environment variables.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000; // Railway uses port 3000 by default

console.log('🔑 Environment check:');
console.log(`  - PORT: ${PORT}`);
console.log(`  - OPENAI_API_KEY: ${OPENAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`  - SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);

// Note: OpenAI API key will be loaded per-client from database
if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your_openai_api_key_here') {
  console.log('⚠️ System OpenAI API key not set - will use client-specific keys only');
}

// Initialize Fastify with proper logger configuration
const fastify = Fastify({ 
  logger: true,
  trustProxy: true // Important for Railway deployments
});
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

// Client configuration functions
async function loadClientConfiguration(twilioNumber, callerNumber) {
  try {
    console.log(`🔍 Looking up client config for Twilio number: ${twilioNumber}`);
    
    // Call Supabase Edge Function to load client configuration
    const response = await fetch('https://ycvvuepfsebqpwmamqgg.functions.supabase.co/twilio-client-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        twilioNumber,
        callerNumber
      })
    });

    if (!response.ok) {
      console.log(`⚠️ No client config found (${response.status}), using defaults`);
      return null;
    }

    const data = await response.json();
    
    if (data.useDefault) {
      console.log('📋 API indicates to use default configuration');
      return null;
    }

    if (!data.success || !data.config) {
      console.log('❌ Invalid response from client config API');
      return null;
    }

    console.log(`✅ Client config loaded:`, {
      clientName: data.config.clientName,
      agentName: data.config.agentName,
      hasCustomKey: Boolean(data.config.openaiApiKey)
    });
    
    return data.config;
  } catch (error) {
    console.error('❌ Error loading client configuration:', error);
    return null;
  }
}

function getDefaultConfiguration() {
  return {
    clientId: 'default',
    clientName: 'Default Configuration',
    agentId: 'default',
    systemPrompt: SYSTEM_MESSAGE,
    voice: VOICE,
    openaiApiKey: null,
    twilioAccountSid: null,
    twilioAuthToken: null,
    knowledgeBase: []
  };
}

async function searchKnowledgeBase(clientId, query) {
  try {
    console.log(`🔍 Searching knowledge base for client ${clientId} with query: ${query}`);
    
    // Call Supabase Edge Function for knowledge base search
    const response = await fetch('https://ycvvuepfsebqpwmamqgg.functions.supabase.co/knowledge-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        clientId,
        query,
        limit: 3
      })
    });

    if (!response.ok) {
      console.log(`⚠️ Knowledge base search failed (${response.status})`);
      return '';
    }

    const data = await response.json();
    
    if (data.count > 0) {
      console.log(`✅ Found ${data.count} knowledge base results`);
      return data.context;
    } else {
      console.log('📭 No knowledge base results found');
      return '';
    }
  } catch (error) {
    console.error('❌ Error searching knowledge base:', error);
    return '';
  }
}

// Root Route with health info
fastify.get('/', async (request, reply) => {
  reply.send({ 
    message: 'Twilio Media Stream Server v4.0 - Session Fixed!', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid
  });
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  reply.send({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Test WebSocket endpoint to verify WebSocket functionality
fastify.register(async function (fastify) {
  fastify.get('/ws-test', { websocket: true }, (connection, req) => {
    console.log('🧪 Test WebSocket connected successfully!');
    connection.send('Hello from Railway WebSocket!');
    
    connection.on('message', (message) => {
      console.log('🧪 Test WebSocket received:', message.toString());
      connection.send(`Echo: ${message}`);
    });
    
    connection.on('close', () => {
      console.log('🧪 Test WebSocket disconnected');
    });
  });
});

// Duplicate route removed - keeping only the first /ws-test registration


// Route for Twilio to handle incoming calls - Enhanced with client identification
fastify.all('/incoming-call', async (request, reply) => {
  console.log('=== INCOMING CALL RECEIVED ===');
  console.log('Headers:', request.headers);
  console.log('Body:', request.body);
  console.log('Host:', request.headers.host);
  
  const { To: twilioNumber, From: callerNumber } = request.body;
  console.log(`📞 Incoming call from ${callerNumber} to ${twilioNumber}`);
  
  // Create WebSocket URL with client context parameters
  const streamUrl = `wss://${request.headers.host}/media-stream?to=${encodeURIComponent(twilioNumber)}&from=${encodeURIComponent(callerNumber)}`;
  console.log(`🔗 Generated WebSocket URL: ${streamUrl}`);
  
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                        <Response>
                            <Connect>
                                <Stream url="${streamUrl}" />
                            </Connect>
                            <Pause length="60" />
                        </Response>`;

  console.log('📤 Sending TwiML Response:');
  console.log(twimlResponse);
  
  reply.type('text/xml').send(twimlResponse);
  console.log('✅ TwiML Response sent successfully');
});

// Add WebSocket logging before route registration
console.log('🔌 Registering WebSocket route: /media-stream');

// WebSocket route for media-stream - Enhanced with client-specific configuration
fastify.register(async function (fastify) {
  fastify.get('/media-stream', { websocket: true }, async (connection, req) => {
    console.log('🎯 === MEDIA STREAM WEBSOCKET CONNECTED ===');
    console.log('🔗 Request headers:', req.headers);
    console.log('📊 Query parameters:', req.query);
    console.log('✅ WebSocket connection established successfully!');
    
    // Add connection error handling
    connection.on('error', (error) => {
      console.error('❌ WebSocket connection error:', error);
    });
    
    connection.on('close', (code, reason) => {
      console.log(`🔌 WebSocket closed - Code: ${code}, Reason: ${reason}`);
    });
    
    // Extract client context from query parameters
    const { to: twilioNumber, from: callerNumber } = req.query;
    console.log(`🔍 Identifying client for call: ${callerNumber} → ${twilioNumber}`);
    
    // Load client-specific configuration
    let clientConfig = await loadClientConfiguration(twilioNumber, callerNumber);
    if (!clientConfig) {
      console.log('⚠️ No client configuration found, using defaults');
      clientConfig = getDefaultConfiguration();
    } else {
      console.log(`✅ Loaded configuration for client: ${clientConfig.clientName}`);
    }

    // Connection-specific state
    let streamSid = null;
    let latestMediaTimestamp = 0;
    let lastAssistantItem = null;
    let markQueue = [];
    let responseStartTimestampTwilio = null;

    // Use client-specific OpenAI API key or system default
    const apiKey = clientConfig.openaiApiKey || OPENAI_API_KEY;
    console.log(`🔑 Using ${clientConfig.openaiApiKey ? 'client-specific' : 'system'} OpenAI API key`);
    
    console.log('🚀 Creating OpenAI WebSocket connection...');
    const openAiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    // Add connection timeout
    const connectionTimeout = setTimeout(() => {
      if (openAiWs.readyState !== WebSocket.OPEN) {
        console.error('❌ OpenAI WebSocket connection timeout');
        openAiWs.close();
      }
    }, 10000); // 10 second timeout

    // FIXED AUDIO FORMAT CONFIGURATION FOR TWILIO COMPATIBILITY - Enhanced with client config
    const initializeSession = () => {
      console.log(`🎯 SESSION INIT v6.0 - Client: ${clientConfig.clientName}`);
      console.log('🔧 CONFIGURING AUDIO FORMATS FOR TWILIO WITH CLIENT-SPECIFIC SETTINGS');
      
      const sessionUpdate = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: clientConfig.systemPrompt,
          voice: clientConfig.voice,
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 200,
            silence_duration_ms: 400
          },
          temperature: 0.7,
          max_response_output_tokens: 'inf'
        }
      };

      console.log(`📤 Sending session configuration for client: ${clientConfig.clientName}`);
      console.log(`🎭 Voice: ${clientConfig.voice}, Custom prompt: ${clientConfig.systemPrompt.substring(0, 50)}...`);
      openAiWs.send(JSON.stringify(sessionUpdate));
      
      // Send initial greeting immediately after session configuration
      sendInitialConversationItem();
    };

    // Send initial conversation item so AI speaks first
    const sendInitialConversationItem = () => {
      console.time('initial_greeting_sent');
      const greeting = 'Hi!';
      
      const initialConversationItem = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `Say "${greeting}"`
            }
          ]
        }
      };

      if (SHOW_TIMING_MATH) console.log('Sending initial conversation item:', JSON.stringify(initialConversationItem));
      openAiWs.send(JSON.stringify(initialConversationItem));
      openAiWs.send(JSON.stringify({ type: 'response.create' }));
      console.timeEnd('initial_greeting_sent');
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
      clearTimeout(connectionTimeout);
      console.log('✅ Connected to the OpenAI Realtime API');
      console.log('🔗 WebSocket readyState:', openAiWs.readyState);
      console.time('session_initialization');
      initializeSession();
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

        if (response.type === 'session.created') {
          console.timeEnd('session_initialization');
          console.log('✅ Session created successfully');
        }

        if (response.type === 'response.created') {
          console.time('response_generation');
          console.log('🤖 OpenAI response started');
        }

        if (response.type === 'response.done') {
          console.timeEnd('response_generation');
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
              console.log(`⚠️ OpenAI WebSocket not ready (state: ${openAiWs.readyState}), dropping audio`);
              console.log('🔍 WebSocket states: CONNECTING=0, OPEN=1, CLOSING=2, CLOSED=3');
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

    // Handle WebSocket close and errors
    openAiWs.on('close', (code, reason) => {
      clearTimeout(connectionTimeout);
      console.log('❌ Disconnected from the OpenAI Realtime API');
      console.log('🔍 Close code:', code, 'Reason:', reason.toString());
    });

    openAiWs.on('error', (error) => {
      clearTimeout(connectionTimeout);
      console.error('💥 Error in the OpenAI WebSocket:', error.message);
      console.error('🔍 Error details:', {
        type: error.type,
        code: error.code,
        target: error.target?.url || 'unknown'
      });
    });
  });
});

// Process monitoring and graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM received - server being terminated by platform');
  console.log('🔍 Process info:', {
    pid: process.pid,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage()
  });
  
  console.log('🔄 Attempting graceful shutdown...');
  fastify.close(() => {
    console.log('✅ Server closed gracefully');
    process.exit(0);
  });
  
  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.log('❌ Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received (Ctrl+C)');
  process.exit(0);
});

// Log unexpected exits
process.on('exit', (code) => {
  console.log(`🏁 Process exiting with code: ${code}`);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Server accessible at: http://0.0.0.0:${PORT}`);
  console.log(`📊 Process info:`, {
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    memory: process.memoryUsage()
  });
  
  // Log server health every 30 seconds
  setInterval(() => {
    console.log(`💓 Health check - Uptime: ${Math.round(process.uptime())}s, Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  }, 30000);
});