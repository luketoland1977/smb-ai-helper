-- Update all Twilio integrations to use the correct webhook URL
UPDATE public.twilio_integrations 
SET webhook_url = 'https://ycvvuepfsebqpwmamqgg.supabase.co/functions/v1/twilio-voice-integration'
WHERE webhook_url IS NULL OR webhook_url != 'https://ycvvuepfsebqpwmamqgg.supabase.co/functions/v1/twilio-voice-integration';