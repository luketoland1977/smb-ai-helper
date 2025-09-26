-- Update the Twilio integration webhook URL to handle voice calls
UPDATE twilio_integrations 
SET webhook_url = 'https://ycvvuepfsebqpwmamqgg.supabase.co/functions/v1/twilio-voice-webhook' 
WHERE phone_number = '(844) 415-2896';