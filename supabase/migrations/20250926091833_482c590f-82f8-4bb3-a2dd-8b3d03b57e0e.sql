-- Create CRM integration types
CREATE TYPE crm_type AS ENUM ('hubspot', 'salesforce', 'pipedrive', 'zoho');

-- Create CRM integrations table
CREATE TABLE public.crm_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  crm_type crm_type NOT NULL,
  name TEXT NOT NULL,
  api_key TEXT,
  api_secret TEXT,
  access_token TEXT,
  refresh_token TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  sync_settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT DEFAULT 'pending',
  sync_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.crm_integrations ENABLE ROW LEVEL SECURITY;

-- Create policies for CRM integrations
CREATE POLICY "Users can manage CRM integrations for their clients" 
ON public.crm_integrations 
FOR ALL 
USING (client_id IN (
  SELECT client_users.client_id 
  FROM client_users 
  WHERE client_users.user_id = auth.uid()
));

-- Add updated_at trigger
CREATE TRIGGER update_crm_integrations_updated_at
BEFORE UPDATE ON public.crm_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update knowledge base documents to support CRM source type
ALTER TABLE public.knowledge_base_documents 
ADD COLUMN IF NOT EXISTS crm_integration_id UUID,
ADD COLUMN IF NOT EXISTS crm_record_id TEXT,
ADD COLUMN IF NOT EXISTS crm_record_type TEXT;

-- Update source_type to include 'crm'
ALTER TABLE public.knowledge_base_documents 
DROP CONSTRAINT IF EXISTS knowledge_base_documents_source_type_check;

ALTER TABLE public.knowledge_base_documents 
ADD CONSTRAINT knowledge_base_documents_source_type_check 
CHECK (source_type IN ('file', 'url', 'crm'));