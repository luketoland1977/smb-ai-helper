-- Add new columns to knowledge_base_documents table to support web scraping
ALTER TABLE knowledge_base_documents 
ADD COLUMN source_type TEXT DEFAULT 'file' CHECK (source_type IN ('file', 'url')),
ADD COLUMN source_url TEXT;

-- Update existing records to have source_type as 'file'
UPDATE knowledge_base_documents 
SET source_type = 'file' 
WHERE source_type IS NULL;