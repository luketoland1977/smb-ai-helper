-- Fix admin user database relationships and clean up client data

-- First, fix the empty client name
UPDATE public.clients 
SET name = 'Unnamed Client' 
WHERE name = '' OR name IS NULL;

-- Add admin user to client_users relationships for all existing clients
-- This ensures the admin can manage all clients
INSERT INTO public.client_users (client_id, user_id, role)
SELECT 
  c.id as client_id,
  '31d0e998-a31c-4356-b014-981935be6a11'::uuid as user_id,
  'admin' as role
FROM public.clients c
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.client_users cu 
  WHERE cu.client_id = c.id 
  AND cu.user_id = '31d0e998-a31c-4356-b014-981935be6a11'::uuid
);