import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const { clientId, query, limit = 3 } = await req.json();
    
    if (!clientId || !query) {
      return new Response(JSON.stringify({ 
        error: 'Missing clientId or query' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🔍 Searching knowledge base for client ${clientId} with query: "${query}"`);

    // Search knowledge base chunks for the client
    const { data: chunks, error } = await supabase
      .from('knowledge_base_chunks')
      .select('content, metadata, chunk_index, knowledge_base_documents!inner(title, filename)')
      .eq('client_id', clientId)
      .textSearch('content', query)
      .order('chunk_index', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error searching knowledge base:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to search knowledge base' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!chunks || chunks.length === 0) {
      console.log('📭 No knowledge base results found');
      return new Response(JSON.stringify({ 
        results: [],
        context: ''
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Format results
    const results = chunks.map(chunk => ({
      content: chunk.content,
      source: chunk.knowledge_base_documents?.title || chunk.knowledge_base_documents?.filename || 'Unknown',
      chunkIndex: chunk.chunk_index
    }));

    // Create context string for AI
    const context = chunks
      .map(chunk => chunk.content)
      .join('\n\n')
      .substring(0, 2000); // Limit context length

    console.log(`✅ Found ${chunks.length} relevant knowledge base chunks`);

    return new Response(JSON.stringify({ 
      results,
      context,
      count: chunks.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in knowledge-search function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});