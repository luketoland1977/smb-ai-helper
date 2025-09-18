import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Audio conversion utilities
function mulawToPcm16(mulawData: Uint8Array): Uint8Array {
  const pcm16Data = new Int16Array(mulawData.length);
  const mulawToLinear = [
    -32124,-31100,-30076,-29052,-28028,-27004,-25980,-24956,
    -23932,-22908,-21884,-20860,-19836,-18812,-17788,-16764,
    -15996,-15484,-14972,-14460,-13948,-13436,-12924,-12412,
    -11900,-11388,-10876,-10364, -9852, -9340, -8828, -8316,
     -7932, -7676, -7420, -7164, -6908, -6652, -6396, -6140,
     -5884, -5628, -5372, -5116, -4860, -4604, -4348, -4092,
     -3900, -3772, -3644, -3516, -3388, -3260, -3132, -3004,
     -2876, -2748, -2620, -2492, -2364, -2236, -2108, -1980,
     -1884, -1820, -1756, -1692, -1628, -1564, -1500, -1436,
     -1372, -1308, -1244, -1180, -1116, -1052,  -988,  -924,
      -876,  -844,  -812,  -780,  -748,  -716,  -684,  -652,
      -620,  -588,  -556,  -524,  -492,  -460,  -428,  -396,
      -372,  -356,  -340,  -324,  -308,  -292,  -276,  -260,
      -244,  -228,  -212,  -196,  -180,  -164,  -148,  -132,
      -120,  -112,  -104,   -96,   -88,   -80,   -72,   -64,
       -56,   -48,   -40,   -32,   -24,   -16,    -8,     0,
     32124, 31100, 30076, 29052, 28028, 27004, 25980, 24956,
     23932, 22908, 21884, 20860, 19836, 18812, 17788, 16764,
     15996, 15484, 14972, 14460, 13948, 13436, 12924, 12412,
     11900, 11388, 10876, 10364,  9852,  9340,  8828,  8316,
      7932,  7676,  7420,  7164,  6908,  6652,  6396,  6140,
      5884,  5628,  5372,  5116,  4860,  4604,  4348,  4092,
      3900,  3772,  3644,  3516,  3388,  3260,  3132,  3004,
      2876,  2748,  2620,  2492,  2364,  2236,  2108,  1980,
      1884,  1820,  1756,  1692,  1628,  1564,  1500,  1436,
      1372,  1308,  1244,  1180,  1116,  1052,   988,   924,
       876,   844,   812,   780,   748,   716,   684,   652,
       620,   588,   556,   524,   492,   460,   428,   396,
       372,   356,   340,   324,   308,   292,   276,   260,
       244,   228,   212,   196,   180,   164,   148,   132,
       120,   112,   104,    96,    88,    80,    72,    64,
        56,    48,    40,    32,    24,    16,     8,     0
  ];
  
  for (let i = 0; i < mulawData.length; i++) {
    pcm16Data[i] = mulawToLinear[mulawData[i]];
  }
  
  const uint8Array = new Uint8Array(pcm16Data.buffer);
  return uint8Array;
}

function pcm16ToMulaw(pcm16Data: Uint8Array): Uint8Array {
  const int16Data = new Int16Array(pcm16Data.buffer);
  const mulawData = new Uint8Array(int16Data.length);
  
  for (let i = 0; i < int16Data.length; i++) {
    const sample = int16Data[i];
    const sign = (sample >> 8) & 0x80;
    let magnitude = sample < 0 ? -sample : sample;
    magnitude = Math.min(magnitude, 32635);
    
    let exp = 7;
    let expMask = 0x4000;
    for (let j = 0; j < 8; j++) {
      if ((magnitude & expMask) !== 0) break;
      exp--;
      expMask >>= 1;
    }
    
    const mantissa = (magnitude >> (exp + 3)) & 0x0F;
    mulawData[i] = ~(sign | (exp << 4) | mantissa);
  }
  
  return mulawData;
}

// Text-to-Speech conversion using OpenAI
async function textToSpeech(text: string, voice: string = 'alloy'): Promise<Uint8Array> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OpenAI API key not found');
  }

  console.log('🎙️ Converting text to speech:', text.substring(0, 50) + '...');
  
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: voice,
      response_format: 'wav', // Use WAV format for better compatibility
      speed: 1.0
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ TTS API error:', response.status, errorText);
    throw new Error(`TTS failed: ${response.status}`);
  }

  const audioData = await response.arrayBuffer();
  const wavData = new Uint8Array(audioData);
  
  // Extract PCM data from WAV file (skip 44-byte header)
  const pcmData = wavData.slice(44);
  
  // Resample to 8kHz mono 16-bit for Twilio compatibility
  return resampleAudio(pcmData, 24000, 8000);
}

// Resample audio from one sample rate to another
function resampleAudio(inputData: Uint8Array, inputSampleRate: number, outputSampleRate: number): Uint8Array {
  const inputSamples = new Int16Array(inputData.buffer);
  const resampleRatio = inputSampleRate / outputSampleRate;
  const outputLength = Math.floor(inputSamples.length / resampleRatio);
  const outputSamples = new Int16Array(outputLength);
  
  for (let i = 0; i < outputLength; i++) {
    const inputIndex = Math.floor(i * resampleRatio);
    outputSamples[i] = inputSamples[inputIndex] || 0;
  }
  
  return new Uint8Array(outputSamples.buffer);
}

// Speech-to-Text conversion using OpenAI
async function speechToText(audioData: Uint8Array): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OpenAI API key not found');
  }

  console.log('🎧 Converting speech to text...');
  
  // Create proper WAV file with headers
  const wavData = createWavFile(audioData, 8000, 1, 16); // 8kHz mono 16-bit for Twilio
  
  const formData = new FormData();
  const blob = new Blob([wavData], { type: 'audio/wav' });
  formData.append('file', blob, 'audio.wav');
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ STT API error:', response.status, errorText);
    throw new Error(`STT failed: ${response.status}`);
  }

  const result = await response.json();
  return result.text || '';
}

// Create proper WAV file with headers
function createWavFile(pcmData: Uint8Array, sampleRate: number, channels: number, bitsPerSample: number): Uint8Array {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const wavHeaderLength = 44;
  
  const wavBuffer = new ArrayBuffer(wavHeaderLength + pcmData.length);
  const view = new DataView(wavBuffer);
  
  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + pcmData.length, true); // File size - 8
  view.setUint32(8, 0x57415645, false); // "WAVE"
  
  // Format chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // Format chunk size
  view.setUint16(20, 1, true); // Audio format (1 = PCM)
  view.setUint16(22, channels, true); // Number of channels
  view.setUint32(24, sampleRate, true); // Sample rate
  view.setUint32(28, byteRate, true); // Byte rate
  view.setUint16(32, blockAlign, true); // Block align
  view.setUint16(34, bitsPerSample, true); // Bits per sample
  
  // Data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, pcmData.length, true); // Data size
  
  // Copy PCM data
  const uint8View = new Uint8Array(wavBuffer);
  uint8View.set(pcmData, wavHeaderLength);
  
  return uint8View;
}

// Chat completion using OpenAI
async function getChatResponse(message: string, systemPrompt: string): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OpenAI API key not found');
  }

  console.log('🤖 Getting chat response for:', message.substring(0, 50) + '...');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 150,
      temperature: 0.7
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Chat API error:', response.status, errorText);
    throw new Error(`Chat failed: ${response.status}`);
  }

  const result = await response.json();
  return result.choices[0]?.message?.content || 'I apologize, but I could not process your request.';
}

serve(async (req) => {
  console.log('=== TWILIO REALTIME VOICE FUNCTION STARTED ===');
  
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log('❌ Not a WebSocket request');
    return new Response("Expected WebSocket connection", { status: 426 });
  }

  try {
    const url = new URL(req.url);
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

    const { socket, response } = Deno.upgradeWebSocket(req);
    
    let audioBuffer: Uint8Array[] = [];
    let isProcessing = false;
    let conversationStarted = false;

    socket.onopen = async () => {
      console.log('🔗 Twilio WebSocket connected');
      
      // Send welcome message immediately
      if (!conversationStarted) {
        conversationStarted = true;
        console.log('🎙️ Sending welcome message...');
        
        try {
          const welcomeAudio = await textToSpeech(agentConfig.welcomeMessage, agentConfig.voice);
          const mulawData = pcm16ToMulaw(welcomeAudio);
          
          // Send audio in smaller chunks to ensure proper playback
          const chunkSize = 160; // Standard 20ms chunk for 8kHz
          for (let i = 0; i < mulawData.length; i += chunkSize) {
            const chunk = mulawData.slice(i, i + chunkSize);
            const base64Chunk = btoa(String.fromCharCode(...chunk));
            
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
            
            socket.send(JSON.stringify(mediaMsg));
            
            // Small delay between chunks to prevent buffer overflow
            if (i + chunkSize < mulawData.length) {
              await new Promise(resolve => setTimeout(resolve, 20)); // 20ms delay
            }
          }
          
          console.log('✅ Welcome message sent successfully');
        } catch (error) {
          console.error('❌ Welcome message error:', error);
        }
      }
    };

    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.event === "start") {
          console.log('🎬 Call started');
          
        } else if (data.event === "media") {
          // Collect audio data
          const audioPayload = atob(data.media.payload);
          const mulawData = new Uint8Array(audioPayload.length);
          for (let i = 0; i < audioPayload.length; i++) {
            mulawData[i] = audioPayload.charCodeAt(i);
          }
          
          const pcm16Data = mulawToPcm16(mulawData);
          audioBuffer.push(pcm16Data);
          
          // Process audio when we have enough data and not already processing
          if (audioBuffer.length > 100 && !isProcessing) {
            isProcessing = true;
            console.log('🎧 Processing collected audio...');
            
            try {
              // Combine audio chunks
              const totalLength = audioBuffer.reduce((acc, chunk) => acc + chunk.length, 0);
              const combinedAudio = new Uint8Array(totalLength);
              let offset = 0;
              
              for (const chunk of audioBuffer) {
                combinedAudio.set(chunk, offset);
                offset += chunk.length;
              }
              
              // Clear buffer
              audioBuffer = [];
              
              // Convert to text
              const transcription = await speechToText(combinedAudio);
              console.log('📝 User said:', transcription);
              
              if (transcription.trim().length > 5) {
                // Get AI response
                const aiResponse = await getChatResponse(transcription, agentConfig.prompt);
                console.log('🤖 AI response:', aiResponse);
                
                // Convert to speech
                const responseAudio = await textToSpeech(aiResponse, agentConfig.voice);
                const mulawResponse = pcm16ToMulaw(responseAudio);
                
                // Send response in chunks like welcome message
                const chunkSize = 160; // Standard 20ms chunk for 8kHz
                for (let i = 0; i < mulawResponse.length; i += chunkSize) {
                  const chunk = mulawResponse.slice(i, i + chunkSize);
                  const base64Chunk = btoa(String.fromCharCode(...chunk));
                  
                  const responseMsg = {
                    event: "media",
                    streamSid: callSid,
                    media: {
                      track: "outbound",
                      chunk: (Math.floor(i / chunkSize)).toString(),
                      timestamp: Date.now().toString(),
                      payload: base64Chunk
                    }
                  };
                  
                  socket.send(JSON.stringify(responseMsg));
                  
                  // Small delay between chunks
                  if (i + chunkSize < mulawResponse.length) {
                    await new Promise(resolve => setTimeout(resolve, 20));
                  }
                }
                
                console.log('✅ AI response sent successfully');
              }
              
            } catch (error) {
              console.error('❌ Audio processing error:', error);
            } finally {
              isProcessing = false;
            }
          }
          
        } else if (data.event === "stop") {
          console.log('🛑 Call ended');
          socket.close();
        }
        
      } catch (parseError) {
        console.error('❌ Error parsing Twilio message:', parseError);
      }
    };

    socket.onclose = (event) => {
      console.log('🔌 Twilio WebSocket closed:', event.code, event.reason);
    };

    socket.onerror = (error) => {
      console.error('❌ Twilio WebSocket error:', error);
    };

    return response;

  } catch (error) {
    console.error('💥 Function error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});