-- Drop existing RLS policies for voice_widgets
DROP POLICY IF EXISTS "Users can create voice widgets for their clients" ON public.voice_widgets;
DROP POLICY IF EXISTS "Users can view their own voice widgets" ON public.voice_widgets;
DROP POLICY IF EXISTS "Users can update their own voice widgets" ON public.voice_widgets;
DROP POLICY IF EXISTS "Users can delete their own voice widgets" ON public.voice_widgets;

-- Create a simple public policy like other tables
CREATE POLICY "Public can manage voice widgets" 
ON public.voice_widgets 
FOR ALL 
USING (true) 
WITH CHECK (true);