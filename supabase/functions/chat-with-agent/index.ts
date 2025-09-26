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
    
    // Search for relevant chunks using text similarity
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

    // Combine relevant chunks into context
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
    const { message, agent_id, conversation_id, system_prompt, client_id } = await req.json();

    console.log('Processing chat message:', { message, agent_id, conversation_id, client_id });

    // Get agent-specific OpenAI API key or fall back to global key
    let openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (agent_id) {
      const { data: agent, error } = await supabase
        .from('ai_agents')
        .select('openai_api_key')
        .eq('id', agent_id)
        .single();
      
      if (!error && agent?.openai_api_key) {
        openAIApiKey = agent.openai_api_key;
        console.log('Using agent-specific OpenAI API key');
      }
    }
    
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Build contextual prompt with knowledge base integration
    let contextualPrompt = system_prompt || 'You are a helpful AI customer service agent.';

    // Search knowledge base for relevant context if client_id is provided
    if (client_id) {
      const knowledgeContext = await searchKnowledgeBase(client_id, message);
      if (knowledgeContext) {
        contextualPrompt += `\n\nRelevant information from knowledge base:
${knowledgeContext}

Please use this information to provide accurate, helpful responses. If the knowledge base doesn't contain relevant information for the user's question, rely on your general knowledge but mention that you're providing general guidance.`;
      }
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

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-with-agent function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});