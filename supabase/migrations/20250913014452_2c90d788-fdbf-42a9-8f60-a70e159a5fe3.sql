-- Remove the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Admins can manage other users roles" ON public.user_roles;

-- The Super admin policy is sufficient for managing roles
-- Users can view their own roles (safe)
-- Super admin can do everything (direct UUID check, safe)