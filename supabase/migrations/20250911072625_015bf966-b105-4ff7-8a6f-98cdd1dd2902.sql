-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'salesperson', 'support', 'viewer');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on both tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to handle new user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id, 
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  
  -- Assign default role (viewer for now, admins can upgrade)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- Create RLS policies for user_roles
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" 
ON public.user_roles 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- Update existing table policies to require authentication and roles
-- Clients - only admins and salespeople can manage
DROP POLICY IF EXISTS "Public can manage clients" ON public.clients;
CREATE POLICY "Authenticated users with proper roles can manage clients" 
ON public.clients 
FOR ALL 
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'salesperson')
);

-- AI Agents - only admins and salespeople can manage
DROP POLICY IF EXISTS "Public can manage ai agents" ON public.ai_agents;
CREATE POLICY "Authenticated users with proper roles can manage ai agents" 
ON public.ai_agents 
FOR ALL 
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'salesperson')
);

-- Chat widgets - only admins and salespeople can manage
DROP POLICY IF EXISTS "Public can manage chat widgets" ON public.chat_widgets;
CREATE POLICY "Authenticated users with proper roles can manage chat widgets" 
ON public.chat_widgets 
FOR ALL 
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'salesperson')
);

-- Voice widgets - only admins and salespeople can manage
DROP POLICY IF EXISTS "Public can manage voice widgets" ON public.voice_widgets;
CREATE POLICY "Authenticated users with proper roles can manage voice widgets" 
ON public.voice_widgets 
FOR ALL 
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'salesperson')
);

-- Knowledge base documents - admins, salespeople, and support can manage
DROP POLICY IF EXISTS "Public can manage knowledge base documents" ON public.knowledge_base_documents;
CREATE POLICY "Authenticated users with proper roles can manage knowledge base documents" 
ON public.knowledge_base_documents 
FOR ALL 
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'salesperson') OR
  public.has_role(auth.uid(), 'support')
);

-- Knowledge base chunks - admins, salespeople, and support can manage
DROP POLICY IF EXISTS "Public can manage knowledge base chunks" ON public.knowledge_base_chunks;
CREATE POLICY "Authenticated users with proper roles can manage knowledge base chunks" 
ON public.knowledge_base_chunks 
FOR ALL 
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'salesperson') OR
  public.has_role(auth.uid(), 'support')
);

-- Update timestamps trigger for profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();