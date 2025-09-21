import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const { agentId, clientId } = await req.json();
    
    // Default settings
    let systemPrompt = "You are a helpful AI customer service agent. You assist customers with their inquiries in a friendly and professional manner.";
    let voice = "alloy";
    let model = "gpt-4o-realtime-preview-2024-12-17";
    let apiKey = OPENAI_API_KEY;
    
    // Fetch agent and configuration details if provided
    if (agentId) {
      console.log(`Fetching configuration for agent: ${agentId}`);
      
      // Get agent details and configuration
      const { data: agent, error: agentError } = await supabase
        .from('ai_agents')
        .select(`
          system_prompt,
          openai_api_key,
          agent_configurations (
            voice_settings
          )
        `)
        .eq('id', agentId)
        .single();

      if (agentError) {
        console.error('Error fetching agent:', agentError);
      } else if (agent) {
        console.log('Agent found:', { 
          hasSystemPrompt: !!agent.system_prompt, 
          hasApiKey: !!agent.openai_api_key,
          hasConfig: !!agent.agent_configurations 
        });
        
        // Use agent's system prompt if available
        if (agent.system_prompt) {
          systemPrompt = agent.system_prompt;
        }
        
        // Use agent's OpenAI API key if available
        if (agent.openai_api_key) {
          apiKey = agent.openai_api_key;
        }
        
        // Use voice settings from agent configuration
        if (agent.agent_configurations?.[0]?.voice_settings) {
          const voiceSettings = agent.agent_configurations[0].voice_settings;
          if (voiceSettings.voice) {
            voice = voiceSettings.voice;
          }
          if (voiceSettings.model) {
            model = voiceSettings.model;
          }
        }
      }
    } else if (clientId) {
      console.log(`Fetching default agent for client: ${clientId}`);
      
      // Get default agent for client
      const { data: agent, error: agentError } = await supabase
        .from('ai_agents')
        .select(`
          system_prompt,
          openai_api_key,
          agent_configurations (
            voice_settings
          )
        `)
        .eq('client_id', clientId)
        .eq('is_default', true)
        .single();

      if (agentError) {
        console.error('Error fetching default agent:', agentError);
      } else if (agent) {
        console.log('Default agent found for client');
        
        if (agent.system_prompt) {
          systemPrompt = agent.system_prompt;
        }
        
        if (agent.openai_api_key) {
          apiKey = agent.openai_api_key;
        }
        
        if (agent.agent_configurations?.[0]?.voice_settings) {
          const voiceSettings = agent.agent_configurations[0].voice_settings;
          if (voiceSettings.voice) {
            voice = voiceSettings.voice;
          }
          if (voiceSettings.model) {
            model = voiceSettings.model;
          }
        }
      }
    }

    console.log('Final settings:', { model, voice, hasCustomApiKey: apiKey !== OPENAI_API_KEY });

    // Request an ephemeral token from OpenAI
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice, // Natural voice options: alloy, ash, ballad, coral, echo, sage, shimmer, verse
        instructions: systemPrompt
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', response.status, errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Realtime session created:", data);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error creating realtime session:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});