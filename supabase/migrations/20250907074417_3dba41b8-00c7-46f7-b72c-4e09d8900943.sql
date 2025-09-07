-- Create Twilio integrations table
CREATE TABLE public.twilio_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  account_sid TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT true,
  voice_enabled BOOLEAN NOT NULL DEFAULT true,
  voice_settings JSONB DEFAULT '{"voice": "alice", "language": "en-US"}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.twilio_integrations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public can manage Twilio integrations" 
ON public.twilio_integrations 
FOR ALL 
USING (true);

-- Add communication channel to conversations
ALTER TABLE public.conversations 
ADD COLUMN communication_channel TEXT DEFAULT 'web' CHECK (communication_channel IN ('web', 'sms', 'voice')),
ADD COLUMN phone_number TEXT,
ADD COLUMN twilio_session_id TEXT;

-- Add communication channel to chat_sessions for compatibility
ALTER TABLE public.chat_sessions 
ADD COLUMN communication_channel TEXT DEFAULT 'web' CHECK (communication_channel IN ('web', 'sms', 'voice')),
ADD COLUMN phone_number TEXT,
ADD COLUMN twilio_session_id TEXT;

-- Create trigger for updated_at on twilio_integrations
CREATE TRIGGER update_twilio_integrations_updated_at
BEFORE UPDATE ON public.twilio_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();