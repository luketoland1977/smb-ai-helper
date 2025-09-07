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

// Send SMS via Twilio
async function sendSMS(to: string, from: string, message: string): Promise<void> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  
  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured');
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = btoa(`${accountSid}:${authToken}`);

  const formData = new URLSearchParams();
  formData.append('To', to);
  formData.append('From', from);
  formData.append('Body', message);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Twilio SMS error:', response.status, errorText);
    throw new Error(`Failed to send SMS: ${response.status}`);
  }

  console.log('SMS sent successfully');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse form data from Twilio webhook
    const formData = await req.formData();
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const body = formData.get('Body') as string;
    const messageSid = formData.get('MessageSid') as string;

    console.log('Received SMS:', { from, to, body, messageSid });

    if (!from || !to || !body) {
      throw new Error('Missing required SMS parameters');
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
      .eq('sms_enabled', true)
      .single();

    if (twilioError || !twilioIntegration) {
      console.error('No Twilio integration found for number:', to);
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const clientId = twilioIntegration.client_id;
    
    // Use the agent associated with this phone number
    const agent = twilioIntegration.ai_agents;

    if (!agent) {
      console.error('No agent associated with this phone number:', to);
      await sendSMS(from, to, "I'm sorry, but no agent is configured for this number.");
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
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
      .eq('communication_channel', 'sms')
      .eq('status', 'active')
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
          communication_channel: 'sms',
          phone_number: from,
          status: 'active',
          metadata: { twilio_message_sid: messageSid }
        })
        .select('id')
        .single();

      if (convError || !newConversation) {
        throw new Error('Failed to create conversation');
      }
      conversationId = newConversation.id;
    }

    // Store incoming message
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: body,
        metadata: { twilio_message_sid: messageSid, phone_number: from }
      });

    // Get OpenAI API key
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Build contextual prompt with knowledge base integration
    let contextualPrompt = agent.system_prompt || `You are a helpful AI customer service agent. You assist customers with their inquiries in a friendly and professional manner via SMS.

Guidelines:
- Keep responses concise for SMS (under 160 characters when possible)
- Be polite and helpful
- Provide accurate information based on the knowledge base when available
- Ask clarifying questions when needed
- If you need to provide long information, break it into multiple messages`;

    // Search knowledge base for relevant context
    const knowledgeContext = await searchKnowledgeBase(clientId, body);
    if (knowledgeContext) {
      contextualPrompt += `\n\nRelevant information from knowledge base:
${knowledgeContext}

Please use this information to provide accurate, helpful responses. Keep responses concise for SMS format.`;
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
            content: body
          }
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', response.status, errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Store AI response
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: aiResponse,
        metadata: { channel: 'sms' }
      });

    // Send SMS response
    await sendSMS(from, to, aiResponse);

    console.log('SMS conversation completed successfully');

    // Return empty TwiML response
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('Error in SMS webhook:', error);
    
    // Try to send error message to user if we have the phone numbers
    try {
      const formData = await req.formData();
      const from = formData.get('From') as string;
      const to = formData.get('To') as string;
      
      if (from && to) {
        await sendSMS(from, to, "I'm sorry, I'm experiencing technical difficulties. Please try again in a moment.");
      }
    } catch (sendError) {
      console.error('Failed to send error message:', sendError);
    }

    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
});