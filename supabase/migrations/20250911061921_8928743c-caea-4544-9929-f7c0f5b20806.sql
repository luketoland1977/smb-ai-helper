-- Create voice widgets table
CREATE TABLE public.voice_widgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  widget_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  voice_settings JSONB DEFAULT '{}',
  widget_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.voice_widgets ENABLE ROW LEVEL SECURITY;

-- Create policies for voice widgets
CREATE POLICY "Users can view their own voice widgets" 
ON public.voice_widgets 
FOR SELECT 
USING (auth.uid() = (SELECT user_id FROM public.clients WHERE id = client_id));

CREATE POLICY "Users can create voice widgets for their clients" 
ON public.voice_widgets 
FOR INSERT 
WITH CHECK (auth.uid() = (SELECT user_id FROM public.clients WHERE id = client_id));

CREATE POLICY "Users can update their own voice widgets" 
ON public.voice_widgets 
FOR UPDATE 
USING (auth.uid() = (SELECT user_id FROM public.clients WHERE id = client_id));

CREATE POLICY "Users can delete their own voice widgets" 
ON public.voice_widgets 
FOR DELETE 
USING (auth.uid() = (SELECT user_id FROM public.clients WHERE id = client_id));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_voice_widgets_updated_at
BEFORE UPDATE ON public.voice_widgets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();