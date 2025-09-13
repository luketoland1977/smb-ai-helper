-- Fix the migration by dropping existing policies first
DROP POLICY IF EXISTS "Admins can view all role requests" ON public.role_requests;
DROP POLICY IF EXISTS "Admins can update role requests" ON public.role_requests;
DROP POLICY IF EXISTS "Users can view their own role requests" ON public.role_requests;

-- Update the user registration function to handle role requests
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  requested_role text;
  assigned_role app_role;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id, 
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  
  -- Get the requested role from metadata
  requested_role := NEW.raw_user_meta_data ->> 'requested_role';
  
  -- Assign role based on request, with security controls
  CASE 
    WHEN requested_role = 'admin' THEN
      -- Admin requests need approval - assign viewer for now
      assigned_role := 'viewer'::app_role;
      -- Log the admin request for manual review (only if table exists)
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'role_requests') THEN
        INSERT INTO public.role_requests (user_id, requested_role, status, created_at)
        VALUES (NEW.id, 'admin'::app_role, 'pending', now());
      END IF;
      
    WHEN requested_role = 'salesperson' THEN
      assigned_role := 'salesperson'::app_role;
      
    WHEN requested_role = 'support' THEN
      assigned_role := 'support'::app_role;
      
    ELSE
      -- Default to viewer
      assigned_role := 'viewer'::app_role;
  END CASE;
  
  -- Assign the determined role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role);
  
  RETURN NEW;
END;
$$;

-- Create role requests table for admin approval workflow (if not exists)
CREATE TABLE IF NOT EXISTS public.role_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  requested_role app_role NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  notes text
);

-- Enable RLS if table was just created
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'role_requests' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- RLS policies for role requests
CREATE POLICY "Admins can view all role requests" 
ON public.role_requests 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update role requests" 
ON public.role_requests 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own role requests" 
ON public.role_requests 
FOR SELECT 
USING (auth.uid() = user_id);