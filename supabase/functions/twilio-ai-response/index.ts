import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  console.log('=== TWILIO AI RESPONSE WEBHOOK ===');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse Twilio's form data
    const formData = await req.formData();
    const speechResult = formData.get('SpeechResult')?.toString();
    const from = formData.get('From')?.toString();
    const to = formData.get('To')?.toString();
    
    console.log('👂 User said:', speechResult);
    console.log('📞 Call details:', { from, to });

    if (!speechResult) {
      // No speech detected - ask again
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">I didn't catch that. Could you please repeat your question?</Say>
  <Gather input="speech" timeout="5" speechTimeout="2" action="${supabaseUrl}/functions/v1/twilio-ai-response">
    <Say voice="alice">I'm listening...</Say>
  </Gather>
  <Say voice="alice">Thank you for calling. Goodbye!</Say>
</Response>`;
      
      return new Response(twiml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' }
      });
    }

    // Get agent configuration from database
    let systemPrompt = "You are a helpful customer service agent. Keep responses brief and conversational, under 2 sentences. Be helpful and friendly.";
    
    try {
      const { data: integration } = await supabase
        .from('twilio_integrations')
        .select(`*, ai_agents(*)`)
        .eq('phone_number', to)
        .single();

      if (integration?.ai_agents) {
        systemPrompt = integration.ai_agents.system_prompt || systemPrompt;
        console.log('✅ Loaded agent configuration for', to);
      }
    } catch (error) {
      console.log('⚠️ Using default agent configuration:', error.message);
    }

    // Call OpenAI for response
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('🤖 Calling OpenAI for response...');
    
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: speechResult }
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!openAIResponse.ok) {
      throw new Error(`OpenAI API error: ${await openAIResponse.text()}`);
    }

    const aiResult = await openAIResponse.json();
    const aiMessage = aiResult.choices[0].message.content;
    
    console.log('🤖 AI response:', aiMessage);

    // Generate speech using ElevenLabs
    console.log('🎵 Generating speech with ElevenLabs...');
    const elevenlabsKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenlabsKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const ttsResponse = await fetch('https://api.elevenlabs.io/v1/text-to-speech/9BWtsMINqrJLrRacOk9x', {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenlabsKey,
      },
      body: JSON.stringify({
        text: aiMessage,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    });

    if (!ttsResponse.ok) {
      throw new Error(`ElevenLabs TTS error: ${await ttsResponse.text()}`);
    }

    // Convert audio to base64 for Twilio
    const audioBuffer = await ttsResponse.arrayBuffer();
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
    
    // Create TwiML response with audio playback and continue conversation
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>data:audio/mp3;base64,${base64Audio}</Play>
  <Gather input="speech" timeout="5" speechTimeout="2" action="${supabaseUrl}/functions/v1/twilio-ai-response">
    <Say voice="alice">Is there anything else I can help you with?</Say>
  </Gather>
  <Say voice="alice">Thank you for calling. Have a great day!</Say>
</Response>`;

    return new Response(twiml, {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' }
    });

  } catch (error) {
    console.error('💥 Error:', error);
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">I'm sorry, I'm having technical difficulties. Please try calling again later.</Say>
</Response>`;

    return new Response(errorTwiml, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' }
    });
  }
});