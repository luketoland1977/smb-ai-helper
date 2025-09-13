-- Fix infinite recursion in user_roles RLS policies
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can manage other users roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admin full access" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Create non-recursive policies for user_roles table
-- Users can view their own roles (no function call needed)
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Super admin can do everything (direct UUID check, no function call)
CREATE POLICY "Super admin full access" 
ON public.user_roles 
FOR ALL 
USING (auth.uid() = '31d0e998-a31c-4356-b014-981935be6a11'::uuid);

-- Admins can manage other users' roles (direct role check without function)
CREATE POLICY "Admins can manage other users roles" 
ON public.user_roles 
FOR ALL 
USING (
  auth.uid() <> user_id AND 
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'::app_role
  )
);