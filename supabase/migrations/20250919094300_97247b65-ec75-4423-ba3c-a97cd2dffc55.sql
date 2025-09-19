-- Update the Twilio integration webhook URL to point to Railway Node.js server
UPDATE public.twilio_integrations 
SET voice_webhook_url = 'https://nodejs-server-production-8c73.up.railway.app/incoming-call'
WHERE phone_number = '+18444152896';