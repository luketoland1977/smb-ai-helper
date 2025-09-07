-- Create storage bucket for knowledge base documents
INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge-base', 'knowledge-base', false);

-- Create knowledge_base_documents table
CREATE TABLE IF NOT EXISTS public.knowledge_base_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  content TEXT,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create knowledge_base_chunks table for vector search
CREATE TABLE IF NOT EXISTS public.knowledge_base_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.knowledge_base_documents(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create chat_sessions table for widget conversations
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  visitor_id TEXT,
  customer_name TEXT,
  customer_email TEXT,
  session_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create chat_messages table for widget messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user', 'assistant', 'system'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.knowledge_base_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for knowledge base documents
CREATE POLICY "Users can manage documents for their clients" ON public.knowledge_base_documents
FOR ALL USING (
  client_id IN (
    SELECT client_id FROM public.client_users 
    WHERE user_id = auth.uid()
  )
);

-- RLS policies for knowledge base chunks
CREATE POLICY "Users can view chunks for their clients" ON public.knowledge_base_chunks
FOR ALL USING (
  client_id IN (
    SELECT client_id FROM public.client_users 
    WHERE user_id = auth.uid()
  )
);

-- RLS policies for chat sessions (more permissive for public widget)
CREATE POLICY "Public can create chat sessions" ON public.chat_sessions
FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view sessions for their clients" ON public.chat_sessions
FOR SELECT USING (
  client_id IN (
    SELECT client_id FROM public.client_users 
    WHERE user_id = auth.uid()
  )
);

-- RLS policies for chat messages
CREATE POLICY "Public can create chat messages" ON public.chat_messages
FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view messages for their client sessions" ON public.chat_messages
FOR SELECT USING (
  session_id IN (
    SELECT s.id FROM public.chat_sessions s
    JOIN public.client_users cu ON s.client_id = cu.client_id
    WHERE cu.user_id = auth.uid()
  )
);

-- Storage policies for knowledge base bucket
CREATE POLICY "Users can upload documents for their clients" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'knowledge-base' AND
  (storage.foldername(name))[1] IN (
    SELECT client_id::text FROM public.client_users 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can view documents for their clients" ON storage.objects
FOR SELECT USING (
  bucket_id = 'knowledge-base' AND
  (storage.foldername(name))[1] IN (
    SELECT client_id::text FROM public.client_users 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete documents for their clients" ON storage.objects
FOR DELETE USING (
  bucket_id = 'knowledge-base' AND
  (storage.foldername(name))[1] IN (
    SELECT client_id::text FROM public.client_users 
    WHERE user_id = auth.uid()
  )
);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_knowledge_base_documents_updated_at
  BEFORE UPDATE ON public.knowledge_base_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable real-time for chat functionality
ALTER TABLE public.chat_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;