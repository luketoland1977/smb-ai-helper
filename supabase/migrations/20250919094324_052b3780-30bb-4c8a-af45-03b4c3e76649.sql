-- Update the voice_settings to include the Railway webhook URL
UPDATE public.twilio_integrations 
SET voice_settings = voice_settings || '{"webhook_url": "https://nodejs-server-production-8c73.up.railway.app/incoming-call"}'::jsonb
WHERE phone_number = '+18444152896';