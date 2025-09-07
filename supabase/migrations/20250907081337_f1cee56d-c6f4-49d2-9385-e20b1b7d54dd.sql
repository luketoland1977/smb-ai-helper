-- Add agent_id column to twilio_integrations table
ALTER TABLE public.twilio_integrations 
ADD COLUMN agent_id uuid REFERENCES public.ai_agents(id);

-- Update the existing records to link to an agent if there's only one agent per client
UPDATE public.twilio_integrations 
SET agent_id = (
  SELECT ai_agents.id 
  FROM public.ai_agents 
  WHERE ai_agents.client_id = twilio_integrations.client_id 
  LIMIT 1
)
WHERE agent_id IS NULL;