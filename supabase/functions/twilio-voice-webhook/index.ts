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

// Search knowledge base for relevant content
async function searchKnowledgeBase(clientId: string, query: string): Promise<string | null> {
  try {
    console.log('Searching knowledge base for client:', clientId, 'query:', query);
    
    const { data: chunks, error } = await supabase
      .from('knowledge_base_chunks')
      .select('content, metadata')
      .eq('client_id', clientId)
      .textSearch('content', query.split(' ').join(' | '))
      .limit(3);

    if (error) {
      console.error('Knowledge base search error:', error);
      return null;
    }

    if (!chunks || chunks.length === 0) {
      console.log('No relevant knowledge base content found');
      return null;
    }

    const context = chunks
      .map(chunk => chunk.content)
      .join('\n\n---\n\n');

    console.log('Found relevant knowledge base content:', chunks.length, 'chunks');
    return context;
  } catch (error) {
    console.error('Error searching knowledge base:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 Incoming voice call webhook received');
    
    // Parse form data from Twilio webhook
    const formData = await req.formData();
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;

    console.log('📞 Voice call details:', { from, to, callSid, callStatus });

    // Input validation
    if (!from || !to || !callSid) {
      console.error('❌ Missing required voice call parameters:', { from, to, callSid });
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>Sorry, there was an error processing your call.</Say>
          <Hangup/>
        </Response>`, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
        status: 400
      });
    }

    // Find Twilio integration by phone number with associated agent
    const { data: twilioIntegration, error: twilioError } = await supabase
      .from('twilio_integrations')
      .select(`
        *,
        clients!inner(*),
        ai_agents!inner(*)
      `)
      .eq('phone_number', to)
      .eq('is_active', true)
      .eq('voice_enabled', true)
      .single();

    if (twilioError || !twilioIntegration) {
      console.error('❌ No Twilio voice integration found for number:', to, twilioError);
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>Sorry, this number is not configured for voice calls.</Say>
          <Hangup/>
        </Response>`, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    console.log('✅ Found Twilio integration for voice calls');

    const clientId = twilioIntegration.client_id;
    const agent = twilioIntegration.ai_agents;

    if (!agent) {
      console.error('❌ No agent associated with this phone number:', to);
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>Sorry, no agent is configured for this number.</Say>
          <Hangup/>
        </Response>`, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Check if this is the initial call or a response to user input
    const speechResult = formData.get('SpeechResult') as string;
    const digits = formData.get('Digits') as string;
    
    if (speechResult || digits) {
      // User has provided input - process it with OpenAI
      const userInput = speechResult || digits || '';
      console.log('🎤 User input received:', userInput);

      // Create or find conversation
      let conversationId: string;
      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('client_id', clientId)
        .eq('phone_number', from) 
        .eq('communication_channel', 'voice')
        .eq('twilio_session_id', callSid)
        .single();

      if (existingConversation) {
        conversationId = existingConversation.id;
      } else {
        // Create new conversation
        const { data: newConversation, error: convError } = await supabase
          .from('conversations')
          .insert({
            client_id: clientId,
            agent_id: agent.id,
            communication_channel: 'voice',
            phone_number: from,
            twilio_session_id: callSid,
            status: 'active',
            metadata: { call_sid: callSid }
          })
          .select('id')
          .single();

        if (convError || !newConversation) {
          throw new Error('Failed to create conversation');
        }
        conversationId = newConversation.id;
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

      // Get OpenAI API key
      const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openAIApiKey) {
        throw new Error('OpenAI API key not configured');
      }

      // Build contextual prompt with knowledge base integration
      let contextualPrompt = agent.system_prompt || `You are a helpful AI customer service agent answering phone calls. 

Guidelines:
- Keep responses concise and conversational for voice calls
- Be polite, professional, and helpful
- Provide accurate information based on the knowledge base when available
- Ask clarifying questions when needed
- Speak naturally as if having a phone conversation`;

      // Search knowledge base for relevant context
      const knowledgeContext = await searchKnowledgeBase(clientId, userInput);
      if (knowledgeContext) {
        contextualPrompt += `\n\nRelevant information from knowledge base:
${knowledgeContext}

Please use this information to provide accurate, helpful responses. Keep responses conversational for voice calls.`;
      }

      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: contextualPrompt
            },
            {
              role: 'user',
              content: userInput
            }
          ],
          max_tokens: 200,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ OpenAI API error:', response.status, errorData);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;

      console.log('🤖 AI Response generated:', aiResponse.substring(0, 100) + '...');

      // Store AI response
      await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: aiResponse,
          metadata: { channel: 'voice', call_sid: callSid }
        });

      // Return TwiML with AI response and gather more input
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say voice="${twilioIntegration.voice_settings?.voice || 'alice'}" language="${twilioIntegration.voice_settings?.language || 'en-US'}">${aiResponse}</Say>
          <Gather input="speech" timeout="10" speechTimeout="auto" action="https://ycvvuepfsebqpwmamqgg.supabase.co/functions/v1/twilio-voice-webhook" method="POST">
            <Say voice="${twilioIntegration.voice_settings?.voice || 'alice'}" language="${twilioIntegration.voice_settings?.language || 'en-US'}">Is there anything else I can help you with?</Say>
          </Gather>
          <Say voice="${twilioIntegration.voice_settings?.voice || 'alice'}" language="${twilioIntegration.voice_settings?.language || 'en-US'}">Thank you for calling. Have a great day!</Say>
          <Hangup/>
        </Response>`, {
        headers: { 'Content-Type': 'text/xml' },
      });

    } else {
      // Initial call - greet the user and start conversation
      console.log('👋 Initial call - greeting user');
      
      const greeting = `Hello! You've reached ${twilioIntegration.clients?.name || 'our AI assistant'}. I'm here to help you with any questions you may have. How can I assist you today?`;

      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say voice="${twilioIntegration.voice_settings?.voice || 'alice'}" language="${twilioIntegration.voice_settings?.language || 'en-US'}">${greeting}</Say>
          <Gather input="speech" timeout="10" speechTimeout="auto" action="https://ycvvuepfsebqpwmamqgg.supabase.co/functions/v1/twilio-voice-webhook" method="POST">
            <Say voice="${twilioIntegration.voice_settings?.voice || 'alice'}" language="${twilioIntegration.voice_settings?.language || 'en-US'}">Please tell me how I can help you.</Say>
          </Gather>
          <Say voice="${twilioIntegration.voice_settings?.voice || 'alice'}" language="${twilioIntegration.voice_settings?.language || 'en-US'}">I didn't hear anything. Please try calling again.</Say>
          <Hangup/>
        </Response>`, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

  } catch (error) {
    console.error('❌ Error in voice webhook:', error);
    
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice" language="en-US">I'm sorry, I'm experiencing technical difficulties. Please try calling again in a moment.</Say>
        <Hangup/>
      </Response>`, {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
});