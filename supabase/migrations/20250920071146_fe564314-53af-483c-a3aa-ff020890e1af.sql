-- Add OpenAI API key field to ai_agents table for client-specific configurations
ALTER TABLE public.ai_agents 
ADD COLUMN openai_api_key TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.ai_agents.openai_api_key IS 'Client-provided OpenAI API key for this agent (optional, falls back to system default)';

-- Add webhook URL field to twilio_integrations for dynamic routing
ALTER TABLE public.twilio_integrations
ADD COLUMN webhook_url TEXT;

-- Update existing integrations to use the new dynamic webhook
UPDATE public.twilio_integrations 
SET webhook_url = 'https://ycvvuepfsebqpwmamqgg.functions.supabase.co/twilio-webhook'
WHERE webhook_url IS NULL;