-- Create inbound phone numbers table for Bland AI integration
CREATE TABLE public.bland_inbound_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  integration_id UUID REFERENCES public.bland_integrations(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  bland_number_id TEXT UNIQUE,
  country_code TEXT NOT NULL DEFAULT 'US',
  area_code TEXT,
  webhook_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  monthly_cost DECIMAL(10,2),
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bland_inbound_numbers ENABLE ROW LEVEL SECURITY;

-- Create policies for inbound numbers
CREATE POLICY "Users can manage inbound numbers for their clients" 
ON public.bland_inbound_numbers 
FOR ALL 
USING (client_id IN (
  SELECT client_users.client_id 
  FROM client_users 
  WHERE client_users.user_id = auth.uid()
));

-- Create updated_at trigger
CREATE TRIGGER update_bland_inbound_numbers_updated_at
BEFORE UPDATE ON public.bland_inbound_numbers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();