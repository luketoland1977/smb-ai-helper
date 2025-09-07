import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Simple HTML to text conversion
function htmlToText(html: string): string {
  // Remove script and style elements
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, ' ');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

// Extract title from HTML
function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : 'Untitled';
}

// Chunk text into smaller pieces for better search
function chunkText(text: string, chunkSize: number = 1000): string[] {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.substring(i, i + chunkSize));
  }
  return chunks;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, client_id } = await req.json();
    
    if (!url || !client_id) {
      throw new Error('URL and client_id are required');
    }

    console.log('Scraping website:', url, 'for client:', client_id);

    // Fetch the website content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI Service Pro Knowledge Base Scraper)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const title = extractTitle(html);
    const textContent = htmlToText(html);

    if (textContent.length < 100) {
      throw new Error('Website content is too short or could not be extracted');
    }

    console.log('Extracted content:', textContent.length, 'characters');

    // Save document to database
    const { data: document, error: docError } = await supabase
      .from('knowledge_base_documents')
      .insert([{
        client_id: client_id,
        title: title,
        filename: new URL(url).hostname + '.html',
        file_path: url, // Store URL as file path for web sources
        file_size: textContent.length,
        file_type: 'text/html',
        content: textContent,
        processed: true,
        source_type: 'url',
        source_url: url
      }])
      .select()
      .single();

    if (docError) {
      console.error('Error saving document:', docError);
      throw docError;
    }

    console.log('Document saved:', document.id);

    // Create chunks for better search performance
    const chunks = chunkText(textContent);
    const chunkInserts = chunks.map((chunk, index) => ({
      client_id: client_id,
      document_id: document.id,
      chunk_index: index,
      content: chunk,
      metadata: {
        source_url: url,
        title: title,
        chunk_size: chunk.length
      }
    }));

    const { error: chunksError } = await supabase
      .from('knowledge_base_chunks')
      .insert(chunkInserts);

    if (chunksError) {
      console.error('Error saving chunks:', chunksError);
      throw chunksError;
    }

    console.log('Created', chunks.length, 'content chunks');

    return new Response(JSON.stringify({
      success: true,
      document_id: document.id,
      title: title,
      content_length: textContent.length,
      chunks_created: chunks.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in scrape-website function:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Failed to scrape website'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});