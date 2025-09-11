import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Search knowledge base for relevant content
async function searchKnowledgeBase(clientId: string, query: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('knowledge_base_chunks')
      .select('content')
      .eq('client_id', clientId)
      .textSearch('content', query)
      .limit(3);

    if (error) {
      console.error('Error searching knowledge base:', error);
      return null;
    }

    if (data && data.length > 0) {
      return data.map(chunk => chunk.content).join('\n\n');
    }

    return null;
  } catch (error) {
    console.error('Error in searchKnowledgeBase:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, client_id, agent_id, session_id, system_prompt } = await req.json();

    if (!message || !client_id) {
      return new Response(JSON.stringify({ error: 'Message and client_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Search knowledge base for relevant information
    const knowledgeContext = await searchKnowledgeBase(client_id, message);
    
    // Construct the prompt with knowledge base context
    const contextualPrompt = knowledgeContext 
      ? `${system_prompt || 'You are a helpful assistant.'}\n\nRelevant information from the knowledge base:\n${knowledgeContext}\n\nPlease use this information to help answer the user's question when relevant.`
      : system_prompt || 'You are a helpful assistant.';

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
          { role: 'system', content: contextualPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error('Failed to get AI response');
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    return new Response(JSON.stringify({ 
      reply: aiResponse, 
      session_id: session_id || crypto.randomUUID()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in voice-widget function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});