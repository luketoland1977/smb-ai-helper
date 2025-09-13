-- Add policy for admins to manage all Twilio integrations
CREATE POLICY "Admins can manage all Twilio integrations" 
ON public.twilio_integrations 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role))