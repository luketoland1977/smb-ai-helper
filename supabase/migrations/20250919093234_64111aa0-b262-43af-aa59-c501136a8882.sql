-- Fix foreign key constraints to allow proper cascading deletes
-- First, drop the existing foreign key constraint
ALTER TABLE public.twilio_integrations 
DROP CONSTRAINT IF EXISTS twilio_integrations_agent_id_fkey;

-- Add the constraint back with CASCADE delete
ALTER TABLE public.twilio_integrations 
ADD CONSTRAINT twilio_integrations_agent_id_fkey 
FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id) 
ON DELETE CASCADE;

-- Also fix the client_id constraint for proper cascading
ALTER TABLE public.twilio_integrations 
DROP CONSTRAINT IF EXISTS twilio_integrations_client_id_fkey;

ALTER TABLE public.twilio_integrations 
ADD CONSTRAINT twilio_integrations_client_id_fkey 
FOREIGN KEY (client_id) REFERENCES public.clients(id) 
ON DELETE CASCADE;

-- Fix ai_agents client_id constraint too
ALTER TABLE public.ai_agents 
DROP CONSTRAINT IF EXISTS ai_agents_client_id_fkey;

ALTER TABLE public.ai_agents 
ADD CONSTRAINT ai_agents_client_id_fkey 
FOREIGN KEY (client_id) REFERENCES public.clients(id) 
ON DELETE CASCADE;