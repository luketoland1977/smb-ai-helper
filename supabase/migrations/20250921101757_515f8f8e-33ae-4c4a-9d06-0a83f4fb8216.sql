-- Add foreign key constraint between bland_integrations and ai_agents
ALTER TABLE public.bland_integrations 
ADD CONSTRAINT bland_integrations_agent_id_fkey 
FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id) ON DELETE SET NULL;