import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  console.log('=== TWILIO VOICE WEBHOOK CALLED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'incoming';
    console.log('=== WEBHOOK PROCESSING START ===');
    console.log('Action parameter:', action);

    if (action === 'incoming') {
      console.log('Processing incoming call...');
      
      // Parse form data from Twilio webhook
      const formData = await req.formData();
      const from = formData.get('From') as string;
      const to = formData.get('To') as string;
      const callSid = formData.get('CallSid') as string;

      console.log('=== CALL DETAILS ===');
      console.log('From:', from);
      console.log('To:', to);  
      console.log('CallSid:', callSid);

      if (!from || !to || !callSid) {
        console.error('Missing required parameters:', { from, to, callSid });
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, there was an error with the call parameters. Please try again.</Say>
</Response>`;
        return new Response(twiml, {
          headers: { 'Content-Type': 'text/xml' },
        });
      }

      // Direct connection to real-time voice stream (simplified for now)
      console.log('=== GENERATING WEBSOCKET URL ===');
      const realtimeUrl = `wss://ycvvuepfsebqpwmamqgg.functions.supabase.co/v1/twilio-realtime-voice?callSid=${encodeURIComponent(callSid)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      console.log('WebSocket URL:', realtimeUrl);
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${realtimeUrl}" />
    </Connect>
</Response>`;

      console.log('=== TWIML GENERATED ===');
      console.log('Returning TwiML response');
      return new Response(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // All other actions redirect to real-time
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">This service now uses real-time voice. Please hang up and call again.</Say>
</Response>`;

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('Error in Twilio voice webhook:', error);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, there was an error processing your call. Please try again later. Goodbye!</Say>
</Response>`;

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
});