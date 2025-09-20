-- Fix the demo Twilio integration with proper auth tokens and webhook configuration
UPDATE twilio_integrations 
SET 
  auth_token = 'demo_auth_token_replace_with_real',
  webhook_url = 'https://nodejs-production-3c84.up.railway.app/incoming-call',
  voice_settings = jsonb_build_object(
    'voice', 'alloy',
    'language', 'en-US',
    'railway_url', 'https://nodejs-production-3c84.up.railway.app'
  )
WHERE phone_number = '+1234567890';

-- Ensure the demo integration has a valid agent_id
UPDATE twilio_integrations 
SET agent_id = (
  SELECT id FROM ai_agents 
  WHERE name = 'Demo Assistant' 
  LIMIT 1
)
WHERE phone_number = '+1234567890' AND agent_id IS NULL;