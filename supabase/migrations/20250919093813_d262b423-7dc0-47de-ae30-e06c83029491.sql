-- Remove all existing client data (this will cascade to agents and integrations)
DELETE FROM public.clients WHERE name = 'Calmello';

-- Create a demo client for the phone integration
INSERT INTO public.clients (id, name, domain, subdomain, settings, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Demo Customer Service',
  'https://demo.example.com',
  'demo-support',
  '{"demo": true}'::jsonb,
  now(),
  now()
);

-- Create a demo customer service agent
INSERT INTO public.ai_agents (
  id,
  client_id,
  name,
  description,
  system_prompt,
  status,
  settings,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM public.clients WHERE name = 'Demo Customer Service'),
  'Demo Support Agent',
  'AI-powered customer service demonstration agent',
  'You are a friendly AI customer service agent for a demo company. Your role is to:

1. Welcome callers warmly and professionally
2. Answer common questions about products and services  
3. Provide helpful information and assistance
4. Demonstrate natural conversation capabilities
5. Keep responses concise and engaging for phone calls

Guidelines:
- Be friendly and conversational
- Keep responses under 30 seconds for phone calls
- Ask relevant follow-up questions
- Provide clear, helpful answers
- If asked about specific products, explain this is a demo system

Remember: This is a demonstration of AI voice capabilities. Make the conversation natural and showcase the technology effectively.',
  'active'::agent_status,
  '{}'::jsonb,
  now(),
  now()
);

-- Create the Twilio integration for the demo phone number
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
  (SELECT id FROM public.clients WHERE name = 'Demo Customer Service'),
  (SELECT id FROM public.ai_agents WHERE name = 'Demo Support Agent'),
  'AC8353f989efbf435177d7d9a2b6b77a5a',
  '+18444152896',
  true,
  true,
  '{"voice": "alloy", "language": "en-US", "welcome_message": "Hello! Thank you for calling our AI demo service. I''m here to help you experience our voice AI technology. How can I assist you today?"}'::jsonb,
  true,
  now(),
  now()
);