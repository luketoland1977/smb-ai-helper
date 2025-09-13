-- Fix the issue: ensure the user can access admin functions even without client assignments
-- Add a policy for super admins to access core tables without client restrictions

-- Update clients table to allow admins full access
DROP POLICY IF EXISTS "Authenticated users with proper roles can manage clients" ON public.clients;

CREATE POLICY "Admins can manage all clients" 
ON public.clients 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Salespersons can manage clients they have access to" 
ON public.clients 
FOR ALL 
USING (
  has_role(auth.uid(), 'salesperson'::app_role) AND
  id IN (
    SELECT client_users.client_id
    FROM client_users
    WHERE client_users.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'salesperson'::app_role) AND
  id IN (
    SELECT client_users.client_id
    FROM client_users
    WHERE client_users.user_id = auth.uid()
  )
);

-- Update ai_agents table to allow admins full access
DROP POLICY IF EXISTS "Authenticated users with proper roles can manage ai agents" ON public.ai_agents;

CREATE POLICY "Admins can manage all ai agents" 
ON public.ai_agents 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Salespersons can manage agents for their clients" 
ON public.ai_agents 
FOR ALL 
USING (
  has_role(auth.uid(), 'salesperson'::app_role) AND
  client_id IN (
    SELECT client_users.client_id
    FROM client_users
    WHERE client_users.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'salesperson'::app_role) AND
  client_id IN (
    SELECT client_users.client_id
    FROM client_users
    WHERE client_users.user_id = auth.uid()
  )
);

-- Update chat_widgets table to allow admins full access
DROP POLICY IF EXISTS "Authenticated users with proper roles can manage chat widgets" ON public.chat_widgets;

CREATE POLICY "Admins can manage all chat widgets" 
ON public.chat_widgets 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Salespersons can manage widgets for their clients" 
ON public.chat_widgets 
FOR ALL 
USING (
  has_role(auth.uid(), 'salesperson'::app_role) AND
  client_id IN (
    SELECT client_users.client_id
    FROM client_users
    WHERE client_users.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'salesperson'::app_role) AND
  client_id IN (
    SELECT client_users.client_id
    FROM client_users
    WHERE client_users.user_id = auth.uid()
  )
);