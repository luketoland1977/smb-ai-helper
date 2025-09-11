import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  console.log('=== TWILIO REALTIME VOICE FUNCTION CALLED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log('Non-WebSocket request received, upgrade header:', upgradeHeader);
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  console.log('WebSocket upgrade request received - attempting upgrade...');
  
  try {
    const { socket, response } = Deno.upgradeWebSocket(req);
    console.log('WebSocket upgrade successful!');

    socket.onopen = () => {
      console.log('WebSocket connection opened!');
      socket.send(JSON.stringify({ 
        event: 'connected', 
        message: 'Connected to PRO WEB SUPPORT AI' 
      }));
    };

    socket.onmessage = (event) => {
      console.log('Received WebSocket message:', event.data);
      // Echo back for now
      socket.send(JSON.stringify({ 
        event: 'echo', 
        data: 'Received: ' + event.data 
      }));
    };

    socket.onclose = () => {
      console.log('WebSocket connection closed');
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return response;
  } catch (error) {
    console.error('Error upgrading to WebSocket:', error);
    return new Response("WebSocket upgrade failed: " + error.message, { status: 500 });
  }
});