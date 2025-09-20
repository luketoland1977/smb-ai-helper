-- Fix the demo Twilio integration (844) 415-2896 
UPDATE twilio_integrations 
SET 
  webhook_url = 'https://nodejs-production-3c84.up.railway.app/incoming-call',
  voice_settings = COALESCE(voice_settings, '{}'::jsonb) || '{"railway_url": "https://nodejs-production-3c84.up.railway.app"}'::jsonb
WHERE phone_number = '+18444152896';