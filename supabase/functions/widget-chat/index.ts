import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, client_id, agent_id, session_id, system_prompt } = await req.json();
    
    console.log('Processing chat message:', { message, client_id, agent_id, session_id });

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // TODO: Implement knowledge base search here
    // For now, we'll use the basic system prompt
    let contextualPrompt = system_prompt || `You are a helpful AI customer service agent. You assist customers with their inquiries in a friendly and professional manner.

Guidelines:
- Be polite and helpful
- Provide accurate information
- Ask clarifying questions when needed
- Escalate complex issues when appropriate
- Keep responses concise but thorough`;

    // TODO: Add knowledge base context
    // const knowledgeContext = await searchKnowledgeBase(client_id, message);
    // if (knowledgeContext) {
    //   contextualPrompt += `\n\nRelevant information from knowledge base:\n${knowledgeContext}`;
    // }

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
            content: message
          }
        ],
        max_tokens: 500,
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

    console.log('AI response generated successfully');

    return new Response(JSON.stringify({ 
      response: aiResponse,
      session_id: session_id 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in widget-chat function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      response: 'I apologize, but I\'m experiencing technical difficulties. Please try again in a moment.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});