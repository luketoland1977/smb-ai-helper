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
      // Parse form data from Twilio webhook
      const formData = await req.formData();
      const from = formData.get('From') as string;
      const to = formData.get('To') as string;
      const callSid = formData.get('CallSid') as string;

      console.log('Incoming call:', { from, to, callSid });

      // Simple phone number lookup - directly check for (844) 789-0436
      const { data: twilioIntegration, error: twilioError } = await supabase
        .from('twilio_integrations')
        .select(`
          *,
          ai_agents (
            id,
            name,
            system_prompt,
            settings
          )
        `)
        .eq('phone_number', '(844) 789-0436')
        .eq('is_active', true)
        .eq('voice_enabled', true)
        .single();

      if (twilioError || !twilioIntegration) {
        console.error('No Twilio integration found for (844) 789-0436:', twilioError);
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, this number is not configured for voice support. Please contact support.</Say>
</Response>`;
        return new Response(twiml, {
          headers: { 'Content-Type': 'text/xml' },
        });
      }

      console.log('Found integration, connecting to WebSocket...');
      
      // Use the correct WebSocket URL format for Supabase functions
      const realtimeUrl = `wss://ycvvuepfsebqpwmamqgg.functions.supabase.co/twilio-realtime-voice?callSid=${encodeURIComponent(callSid)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      
      console.log('WebSocket URL:', realtimeUrl);
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${realtimeUrl}" />
    </Connect>
</Response>`;

      console.log('Generated WebSocket TwiML');
      return new Response(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Fallback response
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Thank you for calling. Please hang up and call again.</Say>
</Response>`;

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('Error in Twilio voice webhook:', error);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, there was an error processing your call. Please try again later.</Say>
</Response>`;

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
});