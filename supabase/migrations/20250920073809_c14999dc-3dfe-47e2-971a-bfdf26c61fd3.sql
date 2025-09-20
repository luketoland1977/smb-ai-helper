-- Add auth_token column to twilio_integrations table for client-specific Twilio credentials
ALTER TABLE public.twilio_integrations 
ADD COLUMN auth_token text;

-- Add comment for documentation
COMMENT ON COLUMN public.twilio_integrations.auth_token IS 'Encrypted Twilio Auth Token for client-specific integration';