-- Drop the conflicting ALL policy for salespersons
DROP POLICY "Salespersons can manage clients they have access to" ON public.clients;

-- Create separate policies for SELECT, UPDATE, DELETE that don't interfere with INSERT
CREATE POLICY "Salespersons can view clients they have access to" 
ON public.clients 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'salesperson'::app_role) 
  AND id IN (
    SELECT client_users.client_id
    FROM client_users
    WHERE client_users.user_id = auth.uid()
  )
);

CREATE POLICY "Salespersons can update clients they have access to" 
ON public.clients 
FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'salesperson'::app_role) 
  AND id IN (
    SELECT client_users.client_id
    FROM client_users
    WHERE client_users.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'salesperson'::app_role) 
  AND id IN (
    SELECT client_users.client_id
    FROM client_users
    WHERE client_users.user_id = auth.uid()
  )
);

CREATE POLICY "Salespersons can delete clients they have access to" 
ON public.clients 
FOR DELETE 
TO authenticated
USING (
  has_role(auth.uid(), 'salesperson'::app_role) 
  AND id IN (
    SELECT client_users.client_id
    FROM client_users
    WHERE client_users.user_id = auth.uid()
  )
);