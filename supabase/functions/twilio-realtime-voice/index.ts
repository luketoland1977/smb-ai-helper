import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  console.log('=== TWILIO REALTIME VOICE FUNCTION CALLED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";
  const connectionHeader = headers.get("connection") || "";

  // More detailed WebSocket validation for Twilio
  console.log('Connection header:', connectionHeader);
  console.log('Upgrade header:', upgradeHeader);

  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log('❌ Non-WebSocket request received');
    console.log('Expected: websocket, Got:', upgradeHeader);
    return new Response("Expected WebSocket connection", { 
      status: 400,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  }

  console.log('✅ WebSocket upgrade request received - attempting upgrade...');
  
  try {
    // Extract parameters from URL for logging
    const url = new URL(req.url);
    const callSid = url.searchParams.get('callSid');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    
    console.log('📞 Call parameters:', { callSid, from, to });

    // Upgrade to WebSocket with proper options for Twilio
    const { socket, response } = Deno.upgradeWebSocket(req, {
      protocol: "", // Twilio doesn't require specific protocols
      idleTimeout: 300, // 5 minute timeout
    });
    
    console.log('🚀 WebSocket upgrade successful!');

    socket.onopen = () => {
      console.log('🔗 WebSocket connection opened for Twilio call:', callSid);
      
      // Send Twilio-compatible start message
      try {
        const startMessage = {
          event: "start",
          start: {
            streamSid: callSid,
            accountSid: "PLACEHOLDER", 
            callSid: callSid,
            tracks: ["inbound"],
            mediaFormat: {
              encoding: "audio/x-mulaw",
              sampleRate: 8000,
              channels: 1
            }
          }
        };
        
        console.log('📤 Sending start message to Twilio:', startMessage);
        socket.send(JSON.stringify(startMessage));
        
        // Also send a simple audio response for testing
        setTimeout(() => {
          const mediaMessage = {
            event: "media",
            streamSid: callSid,
            media: {
              track: "outbound",
              chunk: "1",
              timestamp: Date.now().toString(),
              payload: "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=" // Empty audio
            }
          };
          console.log('📤 Sending test media to Twilio');
          socket.send(JSON.stringify(mediaMessage));
        }, 1000);
        
      } catch (error) {
        console.error('❌ Error sending start message:', error);
      }
    };

    socket.onmessage = (event) => {
      try {
        console.log('📨 Received from Twilio:', event.data);
        const data = JSON.parse(event.data);
        
        if (data.event === "start") {
          console.log('🎬 Call started:', data.start);
        } else if (data.event === "media") {
          console.log('🎵 Audio data received, chunk:', data.media?.chunk);
          // Echo the audio back for testing
          const echoMessage = {
            event: "media",
            streamSid: data.streamSid,
            media: {
              track: "outbound", 
              chunk: data.media?.chunk || "1",
              timestamp: Date.now().toString(),
              payload: data.media?.payload || ""
            }
          };
          socket.send(JSON.stringify(echoMessage));
        } else if (data.event === "stop") {
          console.log('🛑 Call stopped:', data.stop);
          socket.close();
        }
        
      } catch (error) {
        console.error('❌ Error processing message:', error);
        console.log('Raw message:', event.data);
      }
    };

    socket.onclose = (event) => {
      console.log('🔌 WebSocket connection closed');
      console.log('Close code:', event.code);
      console.log('Close reason:', event.reason);
    };

    socket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    console.log('✅ Returning WebSocket response to Twilio');
    return response;
    
  } catch (error) {
    console.error('💥 Error upgrading to WebSocket:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    return new Response(`WebSocket upgrade failed: ${error.message}`, { 
      status: 500,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  }
});