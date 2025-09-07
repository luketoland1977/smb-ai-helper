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
  console.log('=== TWILIO VOICE WEBHOOK CALLED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'incoming';
    console.log('Action parameter:', action);

    // Parse form data from Twilio webhook
    console.log('Parsing form data...');
    const formData = await req.formData();
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const callSid = formData.get('CallSid') as string;
    const speechResult = formData.get('SpeechResult') as string;

    console.log('Form data parsed:', { from, to, callSid, speechResult });
    console.log('Voice webhook called:', { action, from, to, callSid, speechResult });

    if (action === 'incoming') {
      // Find agent first to get custom welcome message
      const phoneFormats = [
        to,
        to.replace(/\D/g, ''),
        `+1 ${to.slice(2, 5)} ${to.slice(5, 8)} ${to.slice(8)}`,
        `+${to.slice(1, 2)} ${to.slice(2, 5)} ${to.slice(5, 8)} ${to.slice(8)}`
      ];

      const { data: twilioIntegration } = await supabase
        .from('twilio_integrations')
        .select(`
          *,
          ai_agents (
            name,
            settings,
            system_prompt
          )
        `)
        .in('phone_number', phoneFormats)
        .eq('is_active', true)
        .eq('voice_enabled', true)
        .single();

      // Get custom welcome message from voice settings or agent settings
      let welcomeMessage = "Hello! I'm your AI assistant. How can I help you today?";
      let followUpMessage = "Please tell me what you need help with.";
      
      if (twilioIntegration?.ai_agents) {
        const agent = twilioIntegration.ai_agents;
        const voiceSettings = twilioIntegration.voice_settings || {};
        
        // First check voice settings (from widgets UI), then agent settings
        if (voiceSettings.welcome_message) {
          welcomeMessage = voiceSettings.welcome_message;
        } else if (agent.settings?.welcome_message) {
          welcomeMessage = agent.settings.welcome_message;
        } else if (agent.name) {
          welcomeMessage = `Hello! I'm ${agent.name}, your AI assistant. How can I help you today?`;
        }
        
        if (voiceSettings.follow_up_message) {
          followUpMessage = voiceSettings.follow_up_message;
        } else if (agent.settings?.follow_up_message) {
          followUpMessage = agent.settings.follow_up_message;
        }
      }

      const fullUrl = `https://ycvvuepfsebqpwmamqgg.supabase.co/functions/v1/twilio-voice-webhook?action=process`;
      console.log('Setting gather action URL to:', fullUrl);
      console.log('Using welcome message:', welcomeMessage);
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">${welcomeMessage.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Say>
    <Gather 
        input="speech" 
        action="${fullUrl}"
        method="POST"
        speechTimeout="5"
        speechModel="experimental_conversations"
        enhanced="true">
        <Say voice="alice">${followUpMessage.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Say>
    </Gather>
    <Say voice="alice">I didn't hear anything. Please call back if you need assistance. Goodbye!</Say>
</Response>`;

      console.log('Generated TwiML with custom welcome message');
      return new Response(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    if (action === 'process') {
      // Process speech and generate AI response
      if (!speechResult) {
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, I didn't understand what you said. Please try again.</Say>
    <Gather 
        input="speech" 
        action="${url.origin}${url.pathname}?action=process"
        method="POST"
        speechTimeout="3"
        speechModel="experimental_conversations">
        <Say voice="alice">How can I help you?</Say>
    </Gather>
    <Say voice="alice">Goodbye!</Say>
</Response>`;

        return new Response(twiml, {
          headers: { 'Content-Type': 'text/xml' },
        });
      }

      // Find Twilio integration by phone number - handle different formats
      console.log('Looking for Twilio integration with phone number:', to);
      
      // Try multiple phone number formats
      const phoneFormats = [
        to, // Original format
        to.replace(/\D/g, ''), // Just digits
        `+1 ${to.slice(2, 5)} ${to.slice(5, 8)} ${to.slice(8)}`, // +1 XXX XXX XXXX format
        `+${to.slice(1, 2)} ${to.slice(2, 5)} ${to.slice(5, 8)} ${to.slice(8)}` // +X XXX XXX XXXX format
      ];
      
      console.log('Trying phone number formats:', phoneFormats);
      
      const { data: twilioIntegration, error: twilioError } = await supabase
        .from('twilio_integrations')
        .select('*')
        .in('phone_number', phoneFormats)
        .eq('is_active', true)
        .eq('voice_enabled', true)
        .single();

      if (twilioError || !twilioIntegration) {
        console.error('No Twilio integration found for number:', to);
        console.error('Database error:', twilioError);
        console.error('Searched formats:', phoneFormats);
        
        // Let's also check what integrations exist
        const { data: allIntegrations } = await supabase
          .from('twilio_integrations')
          .select('phone_number, is_active, voice_enabled')
          .eq('is_active', true);
        console.log('Available integrations:', allIntegrations);
        
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, our service is temporarily unavailable. Please try again later. Goodbye!</Say>
</Response>`;

        return new Response(twiml, {
          headers: { 'Content-Type': 'text/xml' },
        });
      }

      const clientId = twilioIntegration.client_id;
      const agentId = twilioIntegration.agent_id;

      // Get the agent details separately
      const { data: agent, error: agentError } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('id', agentId)
        .single();

      if (agentError || !agent) {
        console.error('No agent found for ID:', agentId, agentError);
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, no agent is configured for this number. Please contact support. Goodbye!</Say>
</Response>`;

        return new Response(twiml, {
          headers: { 'Content-Type': 'text/xml' },
        });
      }

      // Check for existing conversation or create new one
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
          console.error('Failed to create conversation:', convError);
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
          content: speechResult,
          metadata: { call_sid: callSid, phone_number: from }
        });

      // Get OpenAI API key
      const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openAIApiKey) {
        console.error('OpenAI API key not configured');
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, my AI service is not configured. Please contact support. Goodbye!</Say>
</Response>`;
        return new Response(twiml, {
          headers: { 'Content-Type': 'text/xml' },
        });
      }

      console.log('OpenAI API key found, generating response...');

      // Build contextual prompt with knowledge base integration
      let contextualPrompt = agent.system_prompt || `You are a helpful AI customer service agent. You assist customers with their inquiries in a friendly and professional manner via phone calls.

Guidelines:
- Keep responses conversational and natural for voice
- Be polite and helpful
- Provide accurate information based on the knowledge base when available
- Ask clarifying questions when needed
- Speak clearly and at a moderate pace
- If the conversation seems complete, offer to help with anything else or say goodbye`;

      // Search knowledge base for relevant context
      const knowledgeContext = await searchKnowledgeBase(clientId, speechResult);
      if (knowledgeContext) {
        contextualPrompt += `\n\nRelevant information from knowledge base:
${knowledgeContext}

Please use this information to provide accurate, helpful responses. Keep responses natural for voice conversation.`;
      }

      console.log('Using GPT-5 model for voice response...');
      console.log('OpenAI API Key available:', !!openAIApiKey);
      console.log('Speech result received:', speechResult);
      
      // Use OpenAI chat completions with voice-optimized model
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-mini-2025-08-07',
          messages: [
            {
              role: 'system',
              content: contextualPrompt + '\n\nIMPORTANT: You are on a phone call. Respond naturally and conversationally as if speaking directly to the caller. Keep responses concise but helpful, and speak in a way that sounds natural when converted to speech.'
            },
            {
              role: 'user',
              content: speechResult
            }
          ],
          max_completion_tokens: 300,
        }),
      });

      console.log('GPT-5 Mini API response status:', response.status);

      if (!response.ok) {
        console.log('GPT-5 Mini failed, falling back to GPT-4o...');
        const errorData = await response.text();
        console.error('GPT-5 Mini error:', response.status, errorData);
        
        // Fallback to standard OpenAI API
        const fallbackResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
                content: speechResult
              }
            ],
            max_tokens: 400,
            temperature: 0.7,
          }),
        });

        if (!fallbackResponse.ok) {
          const fallbackErrorData = await fallbackResponse.text();
          console.error('Fallback API error:', fallbackResponse.status, fallbackErrorData);
          
          const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, I'm having trouble understanding right now. Please try again later. Goodbye!</Say>
</Response>`;
          return new Response(twiml, {
            headers: { 'Content-Type': 'text/xml' },
          });
        }

        const fallbackData = await fallbackResponse.json();
        var aiResponse = fallbackData.choices?.[0]?.message?.content || "I'm here to help you with your request.";
        console.log('Fallback API response used');
      } else {
        const data = await response.json();
        console.log('GPT-5 Mini response received successfully');
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          console.error('Invalid GPT-5 Mini response structure:', data);
          var aiResponse = "I'm here to help you with your request.";
        } else {
          var aiResponse = data.choices[0].message.content;
          console.log('✅ USING GPT-5-MINI MODEL RESPONSE - gpt-5-mini-2025-08-07');
          console.log('GPT-5-Mini model response length:', aiResponse?.length || 0);
        }
      }
      
      console.log('AI response generated:', aiResponse?.substring(0, 100) + '...');

      // Store AI response
      await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: aiResponse,
          metadata: { channel: 'voice', call_sid: callSid }
        });

      // Get voice settings
      const voiceSettings = twilioIntegration.voice_settings || { voice: 'alice', language: 'en-US' };
      const voice = voiceSettings.voice || 'alice';
      
      console.log('Using voice settings:', voiceSettings);

      // Escape XML characters in AI response
      const escapedResponse = aiResponse
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

      console.log('Creating TwiML response with voice:', voice);

      // Create TwiML response with AI message and continue conversation
      const fullUrl = `https://ycvvuepfsebqpwmamqgg.supabase.co/functions/v1/twilio-voice-webhook?action=process`;
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="${voice}">${escapedResponse}</Say>
    <Gather 
        input="speech" 
        action="${fullUrl}"
        method="POST"
        speechTimeout="5"
        speechModel="experimental_conversations">
        <Say voice="${voice}">Is there anything else I can help you with?</Say>
    </Gather>
    <Say voice="${voice}">Thank you for calling. Have a great day! Goodbye!</Say>
</Response>`;

      console.log('TwiML generated successfully, sending response');
      console.log('Voice conversation processed successfully');

      return new Response(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Default response for unknown actions
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, there was an error processing your call. Please try again later. Goodbye!</Say>
</Response>`;

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('Error in voice webhook:', error);
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">I'm sorry, I'm experiencing technical difficulties. Please try again later. Goodbye!</Say>
</Response>`;

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
});