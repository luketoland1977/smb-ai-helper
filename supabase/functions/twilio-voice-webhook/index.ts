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

      // Try multiple phone number formats for integration lookup
      const phoneFormats = [
        to, // Original format (+18447890436)
        to.replace(/\D/g, ''), // Just digits (18447890436)
        `(${to.slice(2, 5)}) ${to.slice(5, 8)}-${to.slice(8)}`, // (844) 789-0436
        `+1 ${to.slice(2, 5)} ${to.slice(5, 8)} ${to.slice(8)}`, // +1 844 789 0436
        `${to.slice(2, 5)}-${to.slice(5, 8)}-${to.slice(8)}`, // 844-789-0436
        `${to.slice(2, 5)}.${to.slice(5, 8)}.${to.slice(8)}` // 844.789.0436
      ];

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
        .in('phone_number', phoneFormats)
        .eq('is_active', true)
        .eq('voice_enabled', true)
        .single();

      if (twilioError || !twilioIntegration) {
        console.error('No Twilio integration found:', twilioError);
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, there is a technical difficulty with this service. Please contact support. Goodbye!</Say>
</Response>`;
        return new Response(twiml, {
          headers: { 'Content-Type': 'text/xml' },
        });
      }

      // Always use real-time voice for all calls
      console.log('Using real-time voice interface for call:', callSid);
      
      // Direct connection to real-time voice stream
      const realtimeUrl = `wss://ycvvuepfsebqpwmamqgg.functions.supabase.co/v1/twilio-realtime-voice?callSid=${encodeURIComponent(callSid)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${realtimeUrl}" />
    </Connect>
</Response>`;

      console.log('Generated real-time TwiML');
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