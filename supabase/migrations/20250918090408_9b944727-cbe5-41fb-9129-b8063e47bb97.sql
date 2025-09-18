UPDATE public.twilio_integrations 
SET voice_settings = '{
  "voice": "elevenlabs_aria", 
  "voice_id": "9BWtsMINqrJLrRacOk9x", 
  "model": "eleven_turbo_v2_5", 
  "language": "en-US",
  "welcome_message": "Hi how can we help ",
  "follow_up_message": ""
}'::jsonb 
WHERE phone_number = '(844) 415-2896';