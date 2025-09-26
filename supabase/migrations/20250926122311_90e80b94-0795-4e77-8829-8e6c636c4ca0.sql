-- Update twilio_integrations voice_settings to include greeting configuration
UPDATE twilio_integrations 
SET voice_settings = voice_settings || jsonb_build_object(
  'greeting_message', 'Hello! I''m connecting you to your AI assistant.',
  'skip_greeting', false,
  'greeting_voice', 'Google.en-US-Chirp3-HD-Aoede'
)
WHERE voice_settings IS NOT NULL;

-- Handle cases where voice_settings is null
UPDATE twilio_integrations 
SET voice_settings = jsonb_build_object(
  'voice', 'alice',
  'language', 'en-US',
  'greeting_message', 'Hello! I''m connecting you to your AI assistant.',
  'skip_greeting', false,
  'greeting_voice', 'Google.en-US-Chirp3-HD-Aoede'
)
WHERE voice_settings IS NULL;