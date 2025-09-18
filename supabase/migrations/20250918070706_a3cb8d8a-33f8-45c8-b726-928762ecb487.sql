-- Add policy to allow salespersons to create client_users records for themselves
CREATE POLICY "Salespersons can create client relationships for themselves" 
ON public.client_users 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'salesperson'::app_role) 
  AND user_id = auth.uid()
);