import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  console.log('=== TWILIO REALTIME VOICE FUNCTION CALLED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log('❌ Non-WebSocket request received');
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  console.log('✅ WebSocket upgrade request received');
  
  try {
    // Extract parameters from URL
    const url = new URL(req.url);
    const callSid = url.searchParams.get('callSid');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    
    console.log('📞 Call parameters:', { callSid, from, to });

    // Upgrade to WebSocket with stable configuration
    const { socket, response } = Deno.upgradeWebSocket(req, {
      idleTimeout: 300, // 5 minutes
    });
    
    console.log('🚀 WebSocket upgrade successful');

    socket.onopen = () => {
      console.log('🔗 WebSocket connection opened for call:', callSid);
      
      // Send simple acknowledgment to keep connection alive
      try {
        const welcomeMessage = {
          event: "connected",
          message: "PRO WEB SUPPORT AI is ready"
        };
        
        console.log('📤 Sending welcome message');
        // Don't send JSON to Twilio initially, wait for their start message
        
      } catch (error) {
        console.error('❌ Error in onopen:', error);
      }
    };

    socket.onmessage = (event) => {
      try {
        console.log('📨 Received from Twilio:', event.data);
        const data = JSON.parse(event.data);
        
        if (data.event === "start") {
          console.log('🎬 Call started - sending greeting');
          
          // Send a simple audio response - just silence to keep connection alive
          const mediaMessage = {
            event: "media",
            streamSid: data.start.streamSid,
            media: {
              track: "outbound",
              chunk: "1",
              timestamp: Date.now().toString(),
              payload: "UklGRiYAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=" // Silence
            }
          };
          
          socket.send(JSON.stringify(mediaMessage));
          console.log('📤 Sent silence to keep connection alive');
          
        } else if (data.event === "media") {
          console.log('🎵 Audio received, chunk:', data.media?.chunk);
          
          // Echo the audio back with a slight delay
          setTimeout(() => {
            const echoMessage = {
              event: "media",
              streamSid: data.streamSid,
              media: {
                track: "outbound",
                chunk: (parseInt(data.media?.chunk || "1") + 1000).toString(),
                timestamp: Date.now().toString(),
                payload: data.media?.payload || ""
              }
            };
            
            socket.send(JSON.stringify(echoMessage));
            console.log('📤 Echoed audio back');
          }, 100);
          
        } else if (data.event === "stop") {
          console.log('🛑 Call stopped');
          socket.close();
        } else {
          console.log('❓ Unknown event:', data.event);
        }
        
      } catch (error) {
        console.error('❌ Error processing message:', error);
        console.log('Raw message data:', event.data);
      }
    };

    socket.onclose = (event) => {
      console.log('🔌 WebSocket closed');
      console.log('Close code:', event.code);
      console.log('Close reason:', event.reason);
      console.log('Was clean:', event.wasClean);
    };

    socket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    console.log('✅ Returning WebSocket response');
    return response;

  } catch (error) {
    console.error('💥 Critical error in WebSocket setup:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(`WebSocket setup failed: ${error.message}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
});
