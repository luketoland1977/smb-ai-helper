-- Add 'text' as a valid source_type option
ALTER TABLE knowledge_base_documents 
DROP CONSTRAINT IF EXISTS knowledge_base_documents_source_type_check;

ALTER TABLE knowledge_base_documents 
ADD CONSTRAINT knowledge_base_documents_source_type_check 
CHECK (source_type IN ('file', 'url', 'crm', 'text'));