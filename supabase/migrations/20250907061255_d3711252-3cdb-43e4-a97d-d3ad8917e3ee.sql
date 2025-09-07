-- Create chat_widgets table for storing widget configurations
CREATE TABLE public.chat_widgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  widget_name TEXT NOT NULL,
  widget_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  embed_code TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.chat_widgets ENABLE ROW LEVEL SECURITY;

-- Create policies for widget management
CREATE POLICY "Public can manage chat widgets" 
ON public.chat_widgets 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_chat_widgets_updated_at
BEFORE UPDATE ON public.chat_widgets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();