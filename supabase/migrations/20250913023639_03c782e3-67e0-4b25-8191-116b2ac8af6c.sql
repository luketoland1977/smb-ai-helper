-- Allow salespersons to create new clients
CREATE POLICY "Salespersons can create new clients" 
ON public.clients 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'salesperson'::app_role));

-- Create a trigger function to automatically add the creating salesperson to client_users
CREATE OR REPLACE FUNCTION public.handle_new_client_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only auto-add if the creator is a salesperson (not an admin)
  IF has_role(auth.uid(), 'salesperson'::app_role) AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    INSERT INTO public.client_users (client_id, user_id, role)
    VALUES (NEW.id, auth.uid(), 'admin');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically assign salesperson to their created clients
CREATE TRIGGER on_client_created
  AFTER INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_client_created();