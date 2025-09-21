import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const blandApiKey = Deno.env.get('BLAND_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  console.log('Bland integration function called:', req.method, req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'webhook';

    switch (action) {
      case 'create-agent':
        return await createBlandAgent(req);
      case 'make-call':
        return await makeOutboundCall(req);
      case 'webhook':
        return await handleWebhook(req);
      case 'get-calls':
        return await getCallHistory(req);
      case 'create-pathway':
        return await createPathway(req);
      case 'create-campaign':
        return await createCampaign(req);
      case 'update-advanced-settings':
        return await updateAdvancedSettings(req);
      case 'create-custom-tool':
        return await createCustomTool(req);
      case 'get-analytics':
        return await getAnalytics(req);
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Error in bland-integration function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function createBlandAgent(req: Request) {
  const { client_id, agent_id, phone_number, voice_settings = {} } = await req.json();

  console.log('Creating Bland AI agent for client:', client_id);

  // Get agent details from database
  const { data: agent, error: agentError } = await supabase
    .from('ai_agents')
    .select('*')
    .eq('id', agent_id)
    .single();

  if (agentError || !agent) {
    console.error('Agent not found:', agentError);
    throw new Error('Agent not found');
  }

  // Get advanced settings if they exist
  const { data: advancedSettings } = await supabase
    .from('bland_advanced_settings')
    .select('*')
    .eq('integration_id', agent_id)
    .maybeSingle();

  // Create agent in Bland AI with advanced settings
  const blandAgentData = {
    name: agent.name,
    prompt: agent.system_prompt || `You are ${agent.name}, a helpful AI assistant.`,
    voice: voice_settings.voice || 'jennifer',
    language: voice_settings.language || 'en-US',
    speed: voice_settings.speed || 1.0,
    webhook_url: `${supabaseUrl}/functions/v1/bland-integration?action=webhook&client_id=${client_id}`,
    // Advanced Bland AI features
    interruption_threshold: advancedSettings?.interruption_threshold || 50,
    voicemail_detection: advancedSettings?.voicemail_detection ?? true,
    silence_timeout: advancedSettings?.silence_timeout || 4,
    max_call_duration: advancedSettings?.max_call_duration || 1800,
    transfer_phone_number: advancedSettings?.transfer_settings?.phone_number,
    custom_greeting: advancedSettings?.custom_greeting,
    hold_music_url: advancedSettings?.hold_music_url,
  };

  console.log('Creating Bland AI agent with data:', blandAgentData);

  const blandResponse = await fetch('https://api.bland.ai/v1/agents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${blandApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(blandAgentData),
  });

  if (!blandResponse.ok) {
    const errorText = await blandResponse.text();
    console.error('Bland AI API error:', errorText);
    throw new Error(`Bland AI API error: ${errorText}`);
  }

  const blandAgent = await blandResponse.json();
  console.log('Bland AI agent created:', blandAgent);

  // Store integration in database
  const { data: integration, error: integrationError } = await supabase
    .from('bland_integrations')
    .insert({
      client_id,
      agent_id,
      bland_agent_id: blandAgent.agent_id,
      phone_number,
      webhook_url: blandAgentData.webhook_url,
      voice_settings,
      settings: { blandAgent },
    })
    .select()
    .single();

  if (integrationError) {
    console.error('Error storing integration:', integrationError);
    throw new Error('Failed to store integration');
  }

  return new Response(JSON.stringify({ 
    success: true, 
    integration,
    bland_agent: blandAgent 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function makeOutboundCall(req: Request) {
  const { integration_id, to_phone, task } = await req.json();

  console.log('Making outbound call via Bland AI:', { integration_id, to_phone });

  // Get integration details
  const { data: integration, error: integrationError } = await supabase
    .from('bland_integrations')
    .select('*')
    .eq('id', integration_id)
    .single();

  if (integrationError || !integration) {
    console.error('Integration not found:', integrationError);
    throw new Error('Integration not found');
  }

  // Make call via Bland AI
  const callData = {
    phone_number: to_phone,
    agent_id: integration.bland_agent_id,
    task: task || 'Have a friendly conversation with the person who answers.',
    voice: integration.voice_settings?.voice || 'jennifer',
    language: integration.voice_settings?.language || 'en-US',
    webhook_url: integration.webhook_url,
  };

  console.log('Making Bland AI call with data:', callData);

  const callResponse = await fetch('https://api.bland.ai/v1/calls', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${blandApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(callData),
  });

  if (!callResponse.ok) {
    const errorText = await callResponse.text();
    console.error('Bland AI call error:', errorText);
    throw new Error(`Failed to make call: ${errorText}`);
  }

  const callResult = await callResponse.json();
  console.log('Bland AI call initiated:', callResult);

  // Update call count
  await supabase
    .from('bland_integrations')
    .update({ 
      total_calls: (integration.total_calls || 0) + 1,
      last_call_at: new Date().toISOString()
    })
    .eq('id', integration_id);

  return new Response(JSON.stringify({ 
    success: true, 
    call: callResult 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleWebhook(req: Request) {
  const url = new URL(req.url);
  const client_id = url.searchParams.get('client_id');
  
  const webhookData = await req.json();
  console.log('Bland AI webhook received:', { client_id, data: webhookData });

  // Log the webhook for debugging
  console.log('Webhook payload:', JSON.stringify(webhookData, null, 2));

  // Handle different webhook events
  if (webhookData.event === 'call_completed') {
    console.log('Call completed:', webhookData.call_id);
    
    // You can store call logs, update statistics, etc.
    // Example: Store call completion in database
    try {
      const { error } = await supabase
        .from('conversations')
        .insert({
          client_id,
          communication_channel: 'bland_ai',
          status: 'completed',
          metadata: {
            bland_call_id: webhookData.call_id,
            duration: webhookData.call_length,
            outcome: webhookData.outcome,
            cost: webhookData.cost,
          }
        });

      if (error) {
        console.error('Error storing call completion:', error);
      }
    } catch (error) {
      console.error('Error processing call completion:', error);
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getCallHistory(req: Request) {
  const url = new URL(req.url);
  const integration_id = url.searchParams.get('integration_id');

  if (!integration_id) {
    throw new Error('integration_id is required');
  }

  // Get integration details
  const { data: integration, error: integrationError } = await supabase
    .from('bland_integrations')
    .select('*')
    .eq('id', integration_id)
    .single();

  if (integrationError || !integration) {
    throw new Error('Integration not found');
  }

  // Get calls from Bland AI
  const callsResponse = await fetch(`https://api.bland.ai/v1/calls?agent_id=${integration.bland_agent_id}`, {
    headers: {
      'Authorization': `Bearer ${blandApiKey}`,
    },
  });

  if (!callsResponse.ok) {
    const errorText = await callsResponse.text();
    console.error('Bland AI calls API error:', errorText);
    throw new Error(`Failed to get calls: ${errorText}`);
  }

  const calls = await callsResponse.json();
  console.log('Bland AI calls retrieved:', calls);

  return new Response(JSON.stringify({ 
    success: true, 
    calls 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function createPathway(req: Request) {
  const { client_id, integration_id, name, description, pathway_config } = await req.json();

  console.log('Creating Bland AI pathway:', { client_id, integration_id, name });

  // Store pathway in database
  const { data: pathway, error: pathwayError } = await supabase
    .from('bland_pathways')
    .insert({
      client_id,
      integration_id,
      name,
      description,
      pathway_config,
    })
    .select()
    .single();

  if (pathwayError) {
    console.error('Error creating pathway:', pathwayError);
    throw new Error('Failed to create pathway');
  }

  return new Response(JSON.stringify({ 
    success: true, 
    pathway 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function createCampaign(req: Request) {
  const { client_id, integration_id, name, description, target_phone_numbers, campaign_config, schedule_config } = await req.json();

  console.log('Creating Bland AI campaign:', { client_id, integration_id, name });

  // Store campaign in database
  const { data: campaign, error: campaignError } = await supabase
    .from('bland_campaigns')
    .insert({
      client_id,
      integration_id,
      name,
      description,
      target_phone_numbers,
      campaign_config,
      schedule_config,
      status: 'draft',
    })
    .select()
    .single();

  if (campaignError) {
    console.error('Error creating campaign:', campaignError);
    throw new Error('Failed to create campaign');
  }

  return new Response(JSON.stringify({ 
    success: true, 
    campaign 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function updateAdvancedSettings(req: Request) {
  const { integration_id, settings } = await req.json();

  console.log('Updating advanced settings:', { integration_id, settings });

  // Upsert advanced settings
  const { data: advancedSettings, error: settingsError } = await supabase
    .from('bland_advanced_settings')
    .upsert({
      integration_id,
      ...settings,
    })
    .select()
    .single();

  if (settingsError) {
    console.error('Error updating advanced settings:', settingsError);
    throw new Error('Failed to update advanced settings');
  }

  return new Response(JSON.stringify({ 
    success: true, 
    settings: advancedSettings 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function createCustomTool(req: Request) {
  const { client_id, integration_id, tool_name, tool_description, tool_config, endpoint_url, api_key_required } = await req.json();

  console.log('Creating custom tool:', { client_id, integration_id, tool_name });

  // Store custom tool in database
  const { data: tool, error: toolError } = await supabase
    .from('bland_custom_tools')
    .insert({
      client_id,
      integration_id,
      tool_name,
      tool_description,
      tool_config,
      endpoint_url,
      api_key_required,
    })
    .select()
    .single();

  if (toolError) {
    console.error('Error creating custom tool:', toolError);
    throw new Error('Failed to create custom tool');
  }

  return new Response(JSON.stringify({ 
    success: true, 
    tool 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getAnalytics(req: Request) {
  const url = new URL(req.url);
  const integration_id = url.searchParams.get('integration_id');

  if (!integration_id) {
    throw new Error('integration_id is required');
  }

  console.log('Getting analytics for integration:', integration_id);

  // Get integration details
  const { data: integration, error: integrationError } = await supabase
    .from('bland_integrations')
    .select('*')
    .eq('id', integration_id)
    .single();

  if (integrationError || !integration) {
    throw new Error('Integration not found');
  }

  // Get analytics from Bland AI API
  const analyticsResponse = await fetch(`https://api.bland.ai/v1/calls/analytics?agent_id=${integration.bland_agent_id}`, {
    headers: {
      'Authorization': `Bearer ${blandApiKey}`,
    },
  });

  if (!analyticsResponse.ok) {
    const errorText = await analyticsResponse.text();
    console.error('Bland AI analytics API error:', errorText);
    throw new Error(`Failed to get analytics: ${errorText}`);
  }

  const analytics = await analyticsResponse.json();

  // Get campaign data from database
  const { data: campaigns } = await supabase
    .from('bland_campaigns')
    .select('*')
    .eq('integration_id', integration_id);

  return new Response(JSON.stringify({ 
    success: true, 
    analytics,
    campaigns: campaigns || []
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}