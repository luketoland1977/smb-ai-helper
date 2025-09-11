-- Update Twilio integration to remove use_realtime false and fix welcome message
UPDATE twilio_integrations 
SET voice_settings = jsonb_set(
  voice_settings - 'use_realtime',
  '{welcome_message}',
  '"Thank you for calling PRO WEB SUPPORT! Our AI assistant is ready to help you with all your web-related questions. Please speak clearly and I will assist you right away."'
)
WHERE phone_number = '(844) 789-0436';