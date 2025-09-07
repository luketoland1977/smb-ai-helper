-- Update RLS policies to allow public access for admin operations

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Authenticated users can create clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;

DROP POLICY IF EXISTS "Users can create client relationships" ON public.client_users;
DROP POLICY IF EXISTS "Users can delete their own client relationships" ON public.client_users;
DROP POLICY IF EXISTS "Users can update their own client relationships" ON public.client_users;
DROP POLICY IF EXISTS "Users can view their own client relationships" ON public.client_users;

DROP POLICY IF EXISTS "Users can manage agents for their clients" ON public.ai_agents;
DROP POLICY IF EXISTS "Users can manage documents for their clients" ON public.knowledge_base_documents;
DROP POLICY IF EXISTS "Users can view chunks for their clients" ON public.knowledge_base_chunks;
DROP POLICY IF EXISTS "Users can manage integrations for their clients" ON public.integrations;

-- Create new public access policies for admin operations
CREATE POLICY "Public can manage clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public can manage client users" ON public.client_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public can manage ai agents" ON public.ai_agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public can manage knowledge base documents" ON public.knowledge_base_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public can manage knowledge base chunks" ON public.knowledge_base_chunks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public can manage integrations" ON public.integrations FOR ALL USING (true) WITH CHECK (true);