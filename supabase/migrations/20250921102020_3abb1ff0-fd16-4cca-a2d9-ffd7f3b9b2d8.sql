-- Create table for Bland AI Pathways (conversation flows)
CREATE TABLE public.bland_pathways (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  integration_id UUID REFERENCES public.bland_integrations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  pathway_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bland_pathways ENABLE ROW LEVEL SECURITY;

-- Create policies for Bland pathways
CREATE POLICY "Users can manage pathways for their clients" 
ON public.bland_pathways 
FOR ALL 
USING (client_id IN (
  SELECT client_id FROM client_users WHERE user_id = auth.uid()
));

-- Create table for Bland AI Campaigns (scheduled outbound calls)
CREATE TABLE public.bland_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  integration_id UUID REFERENCES public.bland_integrations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_phone_numbers TEXT[] NOT NULL DEFAULT '{}',
  campaign_config JSONB NOT NULL DEFAULT '{}',
  schedule_config JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  total_calls INTEGER DEFAULT 0,
  successful_calls INTEGER DEFAULT 0,
  failed_calls INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bland_campaigns ENABLE ROW LEVEL SECURITY;

-- Create policies for Bland campaigns
CREATE POLICY "Users can manage campaigns for their clients" 
ON public.bland_campaigns 
FOR ALL 
USING (client_id IN (
  SELECT client_id FROM client_users WHERE user_id = auth.uid()
));

-- Create table for Advanced Bland AI Settings
CREATE TABLE public.bland_advanced_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID REFERENCES public.bland_integrations(id) ON DELETE CASCADE UNIQUE,
  interruption_threshold DECIMAL DEFAULT 50,
  voicemail_detection BOOLEAN DEFAULT true,
  silence_timeout INTEGER DEFAULT 4,
  max_call_duration INTEGER DEFAULT 1800,
  transfer_settings JSONB DEFAULT '{}',
  webhook_events TEXT[] DEFAULT '{"call_started", "call_completed", "call_failed"}',
  custom_greeting TEXT,
  hold_music_url TEXT,
  time_based_rules JSONB DEFAULT '{}',
  a_b_test_config JSONB DEFAULT '{}',
  analytics_config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bland_advanced_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for advanced settings
CREATE POLICY "Users can manage advanced settings for their integrations" 
ON public.bland_advanced_settings 
FOR ALL 
USING (integration_id IN (
  SELECT bi.id FROM bland_integrations bi 
  JOIN client_users cu ON bi.client_id = cu.client_id 
  WHERE cu.user_id = auth.uid()
));

-- Create table for Custom Tools for Bland AI agents
CREATE TABLE public.bland_custom_tools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  integration_id UUID REFERENCES public.bland_integrations(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  tool_description TEXT,
  tool_config JSONB NOT NULL DEFAULT '{}',
  endpoint_url TEXT,
  api_key_required BOOLEAN DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bland_custom_tools ENABLE ROW LEVEL SECURITY;

-- Create policies for custom tools
CREATE POLICY "Users can manage custom tools for their clients" 
ON public.bland_custom_tools 
FOR ALL 
USING (client_id IN (
  SELECT client_id FROM client_users WHERE user_id = auth.uid()
));

-- Add trigger for updating timestamps
CREATE TRIGGER update_bland_pathways_updated_at
  BEFORE UPDATE ON public.bland_pathways
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bland_campaigns_updated_at
  BEFORE UPDATE ON public.bland_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bland_advanced_settings_updated_at
  BEFORE UPDATE ON public.bland_advanced_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bland_custom_tools_updated_at
  BEFORE UPDATE ON public.bland_custom_tools
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();