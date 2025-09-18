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
    console.log('Action parameter:', action);

    if (action === 'incoming') {
      console.log('🎯 Processing incoming call...');
      
      // Parse form data from Twilio webhook
      const formData = await req.formData();
      const from = formData.get('From') as string;
      const to = formData.get('To') as string;
      const callSid = formData.get('CallSid') as string;

      console.log('📞 Call details:', { from, to, callSid });

      // Use Twilio's built-in speech recognition instead of WebSocket bridging
      console.log('🎤 Setting up Twilio speech recognition with AI response');
      
      // Return TwiML that uses Twilio's speech recognition
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Hello! Thank you for calling. Please tell me how I can help you today.</Say>
  <Gather input="speech" timeout="5" speechTimeout="2" action="https://ycvvuepfsebqpwmamqgg.supabase.co/functions/v1/twilio-ai-response">
    <Say voice="alice">I'm listening...</Say>
  </Gather>
  <Say voice="alice">I didn't hear anything. Please try calling again.</Say>
</Response>`;

      console.log('📋 Returning Speech Recognition TwiML to Twilio');
      return new Response(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Fallback for other actions
    console.log('❓ Unknown action, returning fallback response');
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Thank you for calling. Please hang up and call again.</Say>
</Response>`;

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('❌ Error in Twilio voice webhook:', error);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, there was an error processing your call. Please try again later.</Say>
</Response>`;

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
});