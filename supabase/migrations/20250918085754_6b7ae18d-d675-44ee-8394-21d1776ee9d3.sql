UPDATE public.twilio_integrations 
SET voice_settings = '{
  "voice": "elevenlabs_aria", 
  "voice_id": "9BWtsMINqrJLrRacOk9x", 
  "model": "eleven_turbo_v2_5", 
  "language": "en-US"
}'::jsonb 
WHERE phone_number = '(844) 415-2896';