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

// Function to search knowledge base for client
async function searchKnowledgeBase(clientId: string, query: string): Promise<string | null> {
  try {
    const { data: chunks, error } = await supabase
      .from('knowledge_base_chunks')
      .select('content')
      .eq('client_id', clientId)
      .textSearch('content', query)
      .limit(5);

    if (error) {
      console.error('Error searching knowledge base:', error);
      return null;
    }

    if (!chunks || chunks.length === 0) {
      return null;
    }

    return chunks.map(chunk => chunk.content).join(' ');
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
    const { twilioNumber, callerNumber } = await req.json();
    
    console.log(`🔍 Looking up client config for Twilio number: ${twilioNumber}`);

    // Step 1: Find the Twilio integration by phone number
    const { data: integration, error: integrationError } = await supabase
      .from('twilio_integrations')
      .select(`
        client_id,
        agent_id,
        account_sid,
        auth_token,
        clients!inner(name),
        ai_agents!inner(name, system_prompt, openai_api_key, settings)
      `)
      .eq('phone_number', twilioNumber)
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.log('❌ No active Twilio integration found for number:', twilioNumber);
      return new Response(JSON.stringify({ 
        error: 'No client configuration found',
        useDefault: true 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Build client configuration
    const clientConfig = {
      clientId: integration.client_id,
      clientName: integration.clients.name,
      agentId: integration.agent_id,
      agentName: integration.ai_agents.name,
      systemPrompt: integration.ai_agents.system_prompt || 'You are a helpful AI assistant.',
      voice: integration.ai_agents.settings?.voice || 'alloy',
      openaiApiKey: integration.ai_agents.openai_api_key || null,
      twilioAccountSid: integration.account_sid || null,
      twilioAuthToken: integration.auth_token || null,
      knowledgeBase: []
    };

    // Step 3: Search knowledge base for relevant content (optional initial context)
    try {
      const knowledgeContext = await searchKnowledgeBase(
        integration.client_id, 
        'company information business hours support contact'
      );
      
      if (knowledgeContext) {
        clientConfig.knowledgeBase = [knowledgeContext];
      }
    } catch (kbError) {
      console.error('Error loading knowledge base:', kbError);
      // Continue without knowledge base context
    }

    console.log(`✅ Client config loaded for: ${clientConfig.clientName}`);
    console.log(`🤖 Agent: ${clientConfig.agentName}`);
    console.log(`🔑 Custom API key: ${clientConfig.openaiApiKey ? 'Yes' : 'No'}`);

    return new Response(JSON.stringify({ 
      success: true,
      config: clientConfig 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in twilio-client-config function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      useDefault: true 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});