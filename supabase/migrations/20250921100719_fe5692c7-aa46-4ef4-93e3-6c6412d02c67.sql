-- Create Bland AI integrations table
CREATE TABLE public.bland_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL,
  agent_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Bland AI specific fields
  bland_agent_id text,
  phone_number text NOT NULL,
  webhook_url text,
  
  -- Configuration
  voice_settings jsonb DEFAULT '{"voice": "jennifer", "language": "en-US", "speed": 1.0}'::jsonb,
  settings jsonb DEFAULT '{}'::jsonb,
  
  -- Status
  is_active boolean NOT NULL DEFAULT true,
  
  -- Call tracking
  total_calls integer DEFAULT 0,
  last_call_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.bland_integrations ENABLE ROW LEVEL SECURITY;

-- Create policies for Bland AI integrations (similar to Twilio)
CREATE POLICY "Admins can manage all Bland AI integrations" 
ON public.bland_integrations 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can manage Bland AI integrations for their clients" 
ON public.bland_integrations 
FOR ALL 
USING (client_id IN (
  SELECT client_users.client_id 
  FROM client_users 
  WHERE client_users.user_id = auth.uid()
))
WITH CHECK (client_id IN (
  SELECT client_users.client_id 
  FROM client_users 
  WHERE client_users.user_id = auth.uid()
));

-- Add trigger for updated_at
CREATE TRIGGER update_bland_integrations_updated_at
BEFORE UPDATE ON public.bland_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();