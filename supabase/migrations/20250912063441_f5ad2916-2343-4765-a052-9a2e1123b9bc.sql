-- Fix critical RLS policy vulnerabilities

-- 1. Fix integrations table - restrict to authenticated users with proper client access
DROP POLICY IF EXISTS "Public can manage integrations" ON public.integrations;

CREATE POLICY "Users can manage integrations for their clients" 
ON public.integrations 
FOR ALL 
USING (
  client_id IN (
    SELECT client_users.client_id
    FROM client_users
    WHERE client_users.user_id = auth.uid()
  )
)
WITH CHECK (
  client_id IN (
    SELECT client_users.client_id
    FROM client_users
    WHERE client_users.user_id = auth.uid()
  )
);

-- 2. Fix twilio_integrations table - restrict to authenticated users with proper client access
DROP POLICY IF EXISTS "Public can manage Twilio integrations" ON public.twilio_integrations;

CREATE POLICY "Users can manage Twilio integrations for their clients" 
ON public.twilio_integrations 
FOR ALL 
USING (
  client_id IN (
    SELECT client_users.client_id
    FROM client_users
    WHERE client_users.user_id = auth.uid()
  )
)
WITH CHECK (
  client_id IN (
    SELECT client_users.client_id
    FROM client_users
    WHERE client_users.user_id = auth.uid()
  )
);

-- 3. Fix client_users table - remove public access, restrict to proper user management
DROP POLICY IF EXISTS "Public can manage client users" ON public.client_users;

-- Users can view their own client relationships
CREATE POLICY "Users can view their own client relationships" 
ON public.client_users 
FOR SELECT 
USING (user_id = auth.uid());

-- Only admins can manage client-user relationships
CREATE POLICY "Admins can manage client users" 
ON public.client_users 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. Add role escalation protection - prevent users from modifying their own roles
-- First, let's update the existing user_roles policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Users can view their own roles
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Only admins can manage roles, and they cannot modify their own roles to prevent privilege escalation
CREATE POLICY "Admins can manage other users roles" 
ON public.user_roles 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND user_id != auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND user_id != auth.uid()
);

-- Super admins can manage any roles (including their own) - for initial setup
CREATE POLICY "Super admin full access" 
ON public.user_roles 
FOR ALL 
USING (
  auth.uid() IN (
    SELECT user_id FROM public.user_roles 
    WHERE role = 'admin'::app_role 
    AND user_id = '31d0e998-a31c-4356-b014-981935be6a11'::uuid -- First admin user
  )
);

-- 5. Enhance chat_sessions security - ensure customer data protection
-- Update the existing policy to be more restrictive
DROP POLICY IF EXISTS "Public can create chat sessions" ON public.chat_sessions;

-- Allow widget creation but with proper validation
CREATE POLICY "Widgets can create chat sessions for their clients" 
ON public.chat_sessions 
FOR INSERT 
WITH CHECK (
  -- Either no authentication (widget) or user has access to the client
  client_id IS NOT NULL AND (
    auth.uid() IS NULL OR -- Allow widgets to create sessions
    client_id IN (
      SELECT client_users.client_id
      FROM client_users
      WHERE client_users.user_id = auth.uid()
    )
  )
);

-- 6. Secure conversations table - add update/delete restrictions
DROP POLICY IF EXISTS "Users can view conversations for their clients" ON public.conversations;

CREATE POLICY "Users can view conversations for their clients" 
ON public.conversations 
FOR SELECT 
USING (
  client_id IN (
    SELECT client_users.client_id
    FROM client_users
    WHERE client_users.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create conversations for their clients" 
ON public.conversations 
FOR INSERT 
WITH CHECK (
  client_id IN (
    SELECT client_users.client_id
    FROM client_users
    WHERE client_users.user_id = auth.uid()
  ) OR auth.uid() IS NULL -- Allow widgets to create
);

CREATE POLICY "Users can update conversations for their clients" 
ON public.conversations 
FOR UPDATE 
USING (
  client_id IN (
    SELECT client_users.client_id
    FROM client_users
    WHERE client_users.user_id = auth.uid()
  )
);

-- 7. Add audit logging function for role changes
CREATE OR REPLACE FUNCTION public.audit_role_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    table_name, 
    record_id, 
    action, 
    old_values, 
    new_values, 
    user_id, 
    timestamp
  ) VALUES (
    'user_roles',
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END,
    auth.uid(),
    now()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  user_id uuid,
  timestamp timestamp with time zone DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for role changes
DROP TRIGGER IF EXISTS audit_user_roles_changes ON public.user_roles;
CREATE TRIGGER audit_user_roles_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_changes();