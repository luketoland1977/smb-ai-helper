-- Phase 1: Database Schema Enhancements for One-Agent-Per-Client Architecture

-- Add is_default flag to ai_agents table
ALTER TABLE public.ai_agents 
ADD COLUMN is_default boolean DEFAULT false;

-- Add unique constraint to ensure only one default agent per client
CREATE UNIQUE INDEX idx_ai_agents_default_per_client 
ON public.ai_agents (client_id) 
WHERE is_default = true;

-- Add agent template support
ALTER TABLE public.ai_agents 
ADD COLUMN template_type text DEFAULT 'general',
ADD COLUMN auto_created boolean DEFAULT false;

-- Create agent_configurations table for unified settings
CREATE TABLE public.agent_configurations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  voice_settings jsonb DEFAULT '{"voice": "alloy", "speed": 1.0, "language": "en-US"}'::jsonb,
  chat_settings jsonb DEFAULT '{"theme": "default", "position": "bottom-right"}'::jsonb,
  phone_settings jsonb DEFAULT '{"voice": "alice", "language": "en-US"}'::jsonb,
  knowledge_base_enabled boolean DEFAULT true,
  auto_response_enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on agent_configurations
ALTER TABLE public.agent_configurations ENABLE ROW LEVEL SECURITY;

-- Create policies for agent_configurations
CREATE POLICY "Users can manage configurations for their agents"
ON public.agent_configurations
FOR ALL
USING (
  agent_id IN (
    SELECT a.id 
    FROM ai_agents a
    JOIN client_users cu ON a.client_id = cu.client_id
    WHERE cu.user_id = auth.uid()
  )
);

-- Add trigger for updated_at on agent_configurations
CREATE TRIGGER update_agent_configurations_updated_at
BEFORE UPDATE ON public.agent_configurations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update the handle_new_client_created function to create complete client environment
CREATE OR REPLACE FUNCTION public.handle_new_client_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  new_agent_id uuid;
  new_agent_config_id uuid;
  chat_widget_id uuid;
  voice_widget_id uuid;
BEGIN
  -- Only auto-add if the creator is a salesperson (not an admin)
  IF has_role(auth.uid(), 'salesperson'::app_role) AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    INSERT INTO public.client_users (client_id, user_id, role)
    VALUES (NEW.id, auth.uid(), 'admin');
  END IF;
  
  -- Create default AI agent for the client
  INSERT INTO public.ai_agents (
    client_id, 
    name, 
    description, 
    system_prompt,
    status,
    is_default,
    auto_created,
    template_type
  ) VALUES (
    NEW.id,
    NEW.name || ' Assistant',
    'Default AI assistant for ' || NEW.name,
    'You are a helpful AI assistant for ' || NEW.name || '. You provide excellent customer service and support. Be friendly, professional, and helpful in all interactions.',
    'active'::agent_status,
    true,
    true,
    'general'
  ) RETURNING id INTO new_agent_id;
  
  -- Create agent configuration
  INSERT INTO public.agent_configurations (agent_id)
  VALUES (new_agent_id)
  RETURNING id INTO new_agent_config_id;
  
  -- Create chat widget
  INSERT INTO public.chat_widgets (
    client_id,
    agent_id,
    widget_name,
    embed_code,
    widget_config,
    is_active
  ) VALUES (
    NEW.id,
    new_agent_id,
    NEW.name || ' Chat Widget',
    '<script src="https://ycvvuepfsebqpwmamqgg.supabase.co/storage/v1/object/public/widgets/widget.js" data-client-id="' || NEW.id || '" data-agent-id="' || new_agent_id || '"></script>',
    '{"theme": "default", "position": "bottom-right", "primaryColor": "#3b82f6", "textColor": "#ffffff"}'::jsonb,
    true
  ) RETURNING id INTO chat_widget_id;
  
  -- Create voice widget
  INSERT INTO public.voice_widgets (
    client_id,
    agent_id,
    widget_name,
    widget_code,
    voice_settings,
    is_active
  ) VALUES (
    NEW.id,
    new_agent_id,
    NEW.name || ' Voice Widget',
    '<script src="https://ycvvuepfsebqpwmamqgg.supabase.co/storage/v1/object/public/widgets/voice-widget.js" data-client-id="' || NEW.id || '" data-agent-id="' || new_agent_id || '"></script>',
    '{"voice": "alloy", "speed": 1.0, "language": "en-US"}'::jsonb,
    true
  ) RETURNING id INTO voice_widget_id;
  
  RETURN NEW;
END;
$function$;