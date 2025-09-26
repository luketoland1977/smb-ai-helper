import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 Incoming Twilio voice call');
    
    // Parse form data from Twilio webhook
    const formData = await req.formData();
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const callSid = formData.get('CallSid') as string;
    const speechResult = formData.get('SpeechResult') as string;
    const digits = formData.get('Digits') as string;

    console.log('📞 Call details:', { from, to, callSid, speechResult, digits });

    // Find Twilio integration
    const { data: integration, error: integrationError } = await supabase
      .from('twilio_integrations')
      .select(`
        *,
        clients!inner(name),
        ai_agents!inner(name, system_prompt)
      `)
      .eq('phone_number', to)
      .eq('is_active', true)
      .eq('voice_enabled', true)
      .single();

    if (integrationError || !integration) {
      console.error('❌ No integration found:', to);
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>Sorry, this number is not configured.</Say>
          <Hangup/>
        </Response>`, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const agent = integration.ai_agents;
    const client = integration.clients;

    // Check if this is user input or initial call
    if (speechResult || digits) {
      // User provided input - process with OpenAI
      const userInput = speechResult || digits || '';
      console.log('🎤 Processing user input:', userInput);

      const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openAIApiKey) {
        throw new Error('OpenAI API key not configured');
      }

      // Create conversation if needed
      let conversationId: string;
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('client_id', integration.client_id)
        .eq('phone_number', from)
        .eq('communication_channel', 'voice')
        .eq('twilio_session_id', callSid)
        .single();

      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({
            client_id: integration.client_id,
            agent_id: agent.id,
            communication_channel: 'voice',
            phone_number: from,
            twilio_session_id: callSid,
            status: 'active'
          })
          .select('id')
          .single();

        if (convError || !newConv) {
          throw new Error('Failed to create conversation');
        }
        conversationId = newConv.id;
      }

      // Store user message
      await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: 'user',
          content: userInput,
          metadata: { channel: 'voice', call_sid: callSid }
        });

      // Get AI response
      const systemPrompt = agent.system_prompt || `You are a helpful AI assistant for ${client.name}. Keep responses brief and conversational for phone calls.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userInput }
          ],
          max_tokens: 150,
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;

      console.log('🤖 AI response:', aiResponse);

      // Store AI response
      await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: aiResponse,
          metadata: { channel: 'voice', call_sid: callSid }
        });

      // Return TwiML with AI response
      const voice = integration.voice_settings?.voice || 'alice';
      const language = integration.voice_settings?.language || 'en-US';

      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say voice="${voice}" language="${language}">${aiResponse}</Say>
          <Gather input="speech" timeout="10" speechTimeout="auto" action="https://ycvvuepfsebqpwmamqgg.supabase.co/functions/v1/twilio-voice-handler" method="POST">
            <Say voice="${voice}" language="${language}">Is there anything else I can help you with?</Say>
          </Gather>
          <Say voice="${voice}" language="${language}">Thank you for calling. Goodbye!</Say>
          <Hangup/>
        </Response>`, {
        headers: { 'Content-Type': 'text/xml' },
      });

    } else {
      // Initial call - greet user
      console.log('👋 Initial greeting');
      
      const voice = integration.voice_settings?.voice || 'alice';
      const language = integration.voice_settings?.language || 'en-US';
      const greeting = `Hello! You've reached ${client.name}. I'm your AI assistant. How can I help you today?`;

      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say voice="${voice}" language="${language}">${greeting}</Say>
          <Gather input="speech" timeout="10" speechTimeout="auto" action="https://ycvvuepfsebqpwmamqgg.supabase.co/functions/v1/twilio-voice-handler" method="POST">
            <Say voice="${voice}" language="${language}">Please tell me how I can assist you.</Say>
          </Gather>
          <Say voice="${voice}" language="${language}">I didn't hear anything. Please try again.</Say>
          <Hangup/>
        </Response>`, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

  } catch (error) {
    console.error('❌ Voice handler error:', error);
    
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">I'm sorry, I'm having technical difficulties. Please try again later.</Say>
        <Hangup/>
      </Response>`, {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
});