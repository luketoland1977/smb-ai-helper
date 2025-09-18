-- Update Twilio webhook URL to use the new integrated edge function
UPDATE public.twilio_integrations 
SET voice_settings = voice_settings || '{"webhook_url": "https://ycvvuepfsebqpwmamqgg.supabase.co/functions/v1/twilio-voice-integration/incoming-call"}'::jsonb
WHERE phone_number = '(844) 415-2896';