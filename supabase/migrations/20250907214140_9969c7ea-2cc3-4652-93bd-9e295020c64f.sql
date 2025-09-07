-- Phase 1: Enhanced integrations and CRM support

-- Add OAuth tokens and sync settings to existing integrations table
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS oauth_tokens JSONB DEFAULT '{}'::jsonb;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS sync_settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE;

-- Update integration_type enum to include CRM types
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'hubspot';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'salesforce';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'pipedrive';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'zoho';

-- Create CRM customer mappings table
CREATE TABLE IF NOT EXISTS crm_customer_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
  internal_customer_id TEXT,
  crm_customer_id TEXT NOT NULL,
  crm_type integration_type NOT NULL,
  customer_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(integration_id, crm_customer_id)
);

-- Enable RLS on crm_customer_mappings
ALTER TABLE crm_customer_mappings ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for crm_customer_mappings
CREATE POLICY "Users can manage CRM mappings for their clients" 
ON crm_customer_mappings 
FOR ALL 
USING (client_id IN (
  SELECT client_users.client_id 
  FROM client_users 
  WHERE client_users.user_id = auth.uid()
));

-- Create CRM activities table
CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  crm_activity_id TEXT,
  activity_data JSONB DEFAULT '{}'::jsonb,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on crm_activities
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for crm_activities
CREATE POLICY "Users can view CRM activities for their clients" 
ON crm_activities 
FOR ALL 
USING (conversation_id IN (
  SELECT c.id 
  FROM conversations c
  JOIN client_users cu ON c.client_id = cu.client_id 
  WHERE cu.user_id = auth.uid()
));

-- Add trigger for updated_at on crm_customer_mappings
CREATE TRIGGER update_crm_customer_mappings_updated_at
  BEFORE UPDATE ON crm_customer_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_crm_customer_mappings_client_id ON crm_customer_mappings(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_customer_mappings_integration_id ON crm_customer_mappings(integration_id);
CREATE INDEX IF NOT EXISTS idx_crm_customer_mappings_crm_customer_id ON crm_customer_mappings(crm_customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_conversation_id ON crm_activities(conversation_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_integration_id ON crm_activities(integration_id);