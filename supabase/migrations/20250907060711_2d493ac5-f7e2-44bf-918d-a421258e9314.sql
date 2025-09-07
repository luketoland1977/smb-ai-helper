-- Update storage RLS policies to allow public access for admin operations

-- Drop any existing restrictive storage policies for knowledge-base bucket
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;

-- Create new public access policies for knowledge-base bucket
CREATE POLICY "Public can upload to knowledge-base" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'knowledge-base');

CREATE POLICY "Public can view knowledge-base files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'knowledge-base');

CREATE POLICY "Public can update knowledge-base files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'knowledge-base') 
WITH CHECK (bucket_id = 'knowledge-base');

CREATE POLICY "Public can delete knowledge-base files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'knowledge-base');