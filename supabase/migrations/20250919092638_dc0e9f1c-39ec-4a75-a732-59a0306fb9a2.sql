-- Create Twilio integration record for demo phone number (844) 415-2896
-- First, get the Calmello client and agent IDs (we know they exist from previous queries)

INSERT INTO public.twilio_integrations (
  client_id,
  agent_id,
  account_sid,
  phone_number,
  sms_enabled,
  voice_enabled,
  voice_settings,
  is_active,
  created_at,
  updated_at
) VALUES (
  (SELECT id FROM public.clients WHERE name = 'Calmello' LIMIT 1),
  (SELECT id FROM public.ai_agents WHERE name = 'Calmello Support' LIMIT 1),
  'AC8353f989efbf435177d7d9a2b6b77a5a',  -- Demo Account SID
  '+18444152896',
  true,
  true,
  '{"voice": "alloy", "language": "en-US", "welcome_message": "Hello, you''ve reached Calmello Support. I''m here to help with any questions you may have."}'::jsonb,
  true,
  now(),
  now()
);