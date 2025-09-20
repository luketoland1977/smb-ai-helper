-- Update existing Twilio integrations to remove ElevenLabs references
UPDATE public.twilio_integrations 
SET voice_settings = jsonb_set(
  voice_settings,
  '{voice}',
  '"ai_voice"'
) 
WHERE voice_settings->>'voice' LIKE '%elevenlabs%';

-- Remove ElevenLabs specific fields from voice_settings
UPDATE public.twilio_integrations 
SET voice_settings = voice_settings - 'voice_id' - 'model'
WHERE voice_settings ? 'voice_id';