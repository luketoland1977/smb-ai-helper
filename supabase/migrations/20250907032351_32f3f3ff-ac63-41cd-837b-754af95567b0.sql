-- Add missing RLS policies for client creation and user assignment

-- Allow authenticated users to create clients
CREATE POLICY "Authenticated users can create clients" 
ON public.clients 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow authenticated users to create client_users relationships
CREATE POLICY "Users can create client relationships" 
ON public.client_users 
FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

-- Allow users to update their own client relationships
CREATE POLICY "Users can update their own client relationships" 
ON public.client_users 
FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid());

-- Allow users to delete their own client relationships
CREATE POLICY "Users can delete their own client relationships" 
ON public.client_users 
FOR DELETE 
TO authenticated 
USING (user_id = auth.uid());