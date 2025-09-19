-- Update the Twilio integration to link with the correct agent ID
UPDATE public.twilio_integrations 
SET agent_id = 'e3e2372c-f3ab-41c4-9a8d-9bd4a8851e74'
WHERE phone_number = '+18444152896';