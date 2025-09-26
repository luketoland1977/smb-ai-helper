-- Update webhook URL to use the working Supabase edge function
UPDATE twilio_integrations 
SET webhook_url = 'https://ycvvuepfsebqpwmamqgg.supabase.co/functions/v1/twilio-voice-handler'
WHERE phone_number = '(844) 415-2896';