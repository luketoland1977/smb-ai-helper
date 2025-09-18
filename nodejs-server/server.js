require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const {
  mulawToPcm16,
  pcm16ToMulaw,
  encodeAudioToBase64,
  decodeAudioFromBase64,
  resampleAudio
} = require('./audio-utils');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Create HTTP server
const server = require('http').createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ 
  server,
  path: '/voice-bridge'
});

wss.on('connection', async (ws, req) => {
  console.log('=== NEW TWILIO CONNECTION ===');
  
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const callSid = url.searchParams.get('callSid');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    
    console.log('📞 Incoming call:', { callSid, from, to });

    // Fetch agent configuration from database
    let agentConfig = {
      prompt: "You are a helpful customer service agent. Keep responses brief and conversational, under 2 sentences.",
      voice: "alloy",
      welcomeMessage: "Hello! Thank you for calling. How can I help you today?"
    };
    
    try {
      const { data: integration } = await supabase
        .from('twilio_integrations')
        .select(`*, ai_agents(*)`)
        .eq('phone_number', to)
        .single();

      if (integration?.ai_agents) {
        agentConfig.prompt = integration.ai_agents.system_prompt || agentConfig.prompt;
        agentConfig.voice = integration.voice_settings?.voice || agentConfig.voice;
        agentConfig.welcomeMessage = integration.voice_settings?.welcome_message || agentConfig.welcomeMessage;
        console.log('✅ Loaded agent configuration for', to);
      }
    } catch (error) {
      console.log('⚠️ Using default agent configuration:', error.message);
    }

    let openAISocket = null;
    let sessionReady = false;

    // Connect to OpenAI Realtime API
    const connectToOpenAI = () => {
      return new Promise((resolve, reject) => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          reject(new Error('OpenAI API key not found'));
          return;
        }

        console.log('🤖 Connecting to OpenAI Realtime API...');
        
        // Node.js WebSocket supports proper headers
        openAISocket = new WebSocket(
          "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'OpenAI-Beta': 'realtime=v1'
            }
          }
        );

        openAISocket.on('open', () => {
          console.log('✅ Connected to OpenAI Realtime API');
          resolve();
        });

        openAISocket.on('message', async (data) => {
          try {
            const openAIData = JSON.parse(data.toString());
            console.log('🤖 OpenAI event:', openAIData.type);

            if (openAIData.type === 'session.created') {
              console.log('🎬 OpenAI session created, configuring...');
              
              // Configure session with agent settings
              const sessionUpdate = {
                type: 'session.update',
                session: {
                  modalities: ['text', 'audio'],
                  instructions: agentConfig.prompt,
                  voice: agentConfig.voice,
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
                  temperature: 0.7,
                  max_response_output_tokens: 'inf'
                }
              };
              
              openAISocket.send(JSON.stringify(sessionUpdate));
              
            } else if (openAIData.type === 'session.updated') {
              console.log('✅ OpenAI session configured');
              sessionReady = true;
              
              // Send welcome message
              const welcomeEvent = {
                type: 'conversation.item.create',
                item: {
                  type: 'message',
                  role: 'assistant',
                  content: [
                    {
                      type: 'input_text',
                      text: agentConfig.welcomeMessage
                    }
                  ]
                }
              };
              
              openAISocket.send(JSON.stringify(welcomeEvent));
              openAISocket.send(JSON.stringify({ type: 'response.create' }));
              
            } else if (openAIData.type === 'response.audio.delta') {
              // Convert OpenAI audio to Twilio format
              const pcm16Data = decodeAudioFromBase64(openAIData.delta);
              
              // Resample from 24kHz to 8kHz for Twilio
              const resampledData = resampleAudio(pcm16Data, 24000, 8000);
              const mulawData = pcm16ToMulaw(resampledData);
              
              // Send to Twilio in chunks
              const chunkSize = 160; // 20ms at 8kHz
              for (let i = 0; i < mulawData.length; i += chunkSize) {
                const chunk = mulawData.slice(i, i + chunkSize);
                const base64Chunk = Buffer.from(chunk).toString('base64');
                
                const mediaMsg = {
                  event: "media",
                  streamSid: callSid,
                  media: {
                    track: "outbound",
                    chunk: (Math.floor(i / chunkSize)).toString(),
                    timestamp: Date.now().toString(),
                    payload: base64Chunk
                  }
                };
                
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify(mediaMsg));
                }
                
                // Small delay between chunks
                if (i + chunkSize < mulawData.length) {
                  await new Promise(resolve => setTimeout(resolve, 20));
                }
              }
              
            } else if (openAIData.type === 'response.audio_transcript.delta') {
              console.log('📝 AI said:', openAIData.delta);
              
            } else if (openAIData.type === 'input_audio_buffer.speech_started') {
              console.log('👂 User started speaking');
              
            } else if (openAIData.type === 'input_audio_buffer.speech_stopped') {
              console.log('✋ User stopped speaking');
              
            } else if (openAIData.type === 'conversation.item.input_audio_transcription.completed') {
              console.log('📝 User said:', openAIData.transcript);
              
            } else if (openAIData.type === 'error') {
              console.error('❌ OpenAI API error:', openAIData.error);
            }
            
          } catch (parseError) {
            console.error('❌ Error parsing OpenAI message:', parseError);
          }
        });

        openAISocket.on('error', (error) => {
          console.error('❌ OpenAI WebSocket error:', error);
          reject(error);
        });

        openAISocket.on('close', (code, reason) => {
          console.log('🔌 OpenAI WebSocket closed:', code, reason.toString());
          sessionReady = false;
        });
      });
    };

    // Initialize OpenAI connection
    try {
      await connectToOpenAI();
    } catch (error) {
      console.error('❌ Failed to connect to OpenAI:', error);
      return;
    }

    // Handle Twilio WebSocket messages
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.event === "start") {
          console.log('🎬 Call started');
          
        } else if (message.event === "media" && sessionReady && openAISocket) {
          // Convert Twilio audio to OpenAI format
          const audioPayload = Buffer.from(message.media.payload, 'base64');
          const mulawData = new Uint8Array(audioPayload);
          
          const pcm16Data = mulawToPcm16(mulawData);
          
          // Resample from 8kHz to 24kHz for OpenAI
          const resampledData = resampleAudio(pcm16Data, 8000, 24000);
          const base64Audio = encodeAudioToBase64(resampledData);
          
          // Send to OpenAI
          const audioEvent = {
            type: 'input_audio_buffer.append',
            audio: base64Audio
          };
          
          openAISocket.send(JSON.stringify(audioEvent));
          
        } else if (message.event === "stop") {
          console.log('🛑 Call ended');
          if (openAISocket) {
            openAISocket.close();
          }
        }
        
      } catch (parseError) {
        console.error('❌ Error parsing Twilio message:', parseError);
      }
    });

    ws.on('close', (code, reason) => {
      console.log('🔌 Twilio WebSocket closed:', code, reason.toString());
      if (openAISocket) {
        openAISocket.close();
      }
    });

    ws.on('error', (error) => {
      console.error('❌ Twilio WebSocket error:', error);
      if (openAISocket) {
        openAISocket.close();
      }
    });

  } catch (error) {
    console.error('💥 Connection error:', error);
    ws.close();
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Twilio-OpenAI Voice Bridge running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/voice-bridge`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});