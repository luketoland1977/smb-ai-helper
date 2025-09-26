import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Upload, FileText, Trash2, Download, Link, Globe, Settings, Database } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface Document {
  id: string;
  title: string;
  filename: string;
  file_size: number;
  file_type: string;
  file_path: string;
  processed: boolean;
  created_at: string;
  source_type: 'file' | 'url' | 'crm';
  source_url: string | null;
  crm_integration_id?: string;
  crm_record_type?: string;
}

interface Client {
  id: string;
  name: string;
}

const KnowledgeBase = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [webUrl, setWebUrl] = useState('');
  const [scrapingUrl, setScrapingUrl] = useState(false);
  const [crmIntegrations, setCrmIntegrations] = useState<any[]>([]);
  const [syncingCrm, setSyncingCrm] = useState(false);

  useEffect(() => {
    if (clientId) {
      loadClient();
      loadDocuments();
      loadCrmIntegrations();
    }
  }, [clientId]);

  const loadClient = async () => {
    if (!clientId) return;
    
    const { data, error } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Client not found",
        variant: "destructive",
      });
      navigate('/dashboard');
      return;
    }

    setClient(data);
  };

  const loadDocuments = async () => {
    if (!clientId) return;

    const { data, error } = await supabase
      .from('knowledge_base_documents')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading documents:', error);
      toast({
        title: "Error",
        description: "Failed to load documents",
        variant: "destructive",
      });
    } else {
      setDocuments((data as Document[]) || []);
    }
    setLoading(false);
  };

  const loadCrmIntegrations = async () => {
    if (!clientId) return;

    const { data, error } = await supabase
      .from('crm_integrations')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true);

    if (error) {
      console.error('Error loading CRM integrations:', error);
    } else {
      setCrmIntegrations(data || []);
    }
  };

  const handleSyncCrm = async (integrationId: string) => {
    if (!clientId) return;

    setSyncingCrm(true);
    try {
      const { error } = await supabase.functions
        .invoke('sync-crm-data', {
          body: { 
            integration_id: integrationId,
            client_id: clientId
          }
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "CRM data sync started successfully",
      });

      loadDocuments();
    } catch (error: any) {
      console.error('Error syncing CRM data:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to sync CRM data",
        variant: "destructive",
      });
    } finally {
      setSyncingCrm(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clientId) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Upload file to storage
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${clientId}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('knowledge-base')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setUploadProgress(50);

      // Process document content (for now, just extract text for basic file types)
      let content = '';
      if (file.type === 'text/plain') {
        content = await file.text();
      } else if (file.type === 'application/json') {
        content = await file.text();
      }

      setUploadProgress(75);

      // Save document metadata
      const { error: dbError } = await supabase
        .from('knowledge_base_documents')
        .insert([{
          client_id: clientId,
          title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
          filename: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          content: content,
          processed: content.length > 0
        }]);

      if (dbError) throw dbError;

      setUploadProgress(100);
      
      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });

      loadDocuments();
      
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleUrlScraping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webUrl || !clientId) return;

    setScrapingUrl(true);
    setUploadProgress(0);

    try {
      console.log('Starting web scraping for URL:', webUrl);
      setUploadProgress(25);

      // Call our edge function to scrape the website
      const { data, error } = await supabase.functions
        .invoke('scrape-website', {
          body: { 
            url: webUrl,
            client_id: clientId 
          }
        });

      if (error) throw error;

      setUploadProgress(100);
      
      toast({
        title: "Success",
        description: "Website content scraped and added to knowledge base",
      });

      setWebUrl('');
      loadDocuments();
      
    } catch (error: any) {
      console.error('Error scraping website:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to scrape website content",
        variant: "destructive",
      });
    } finally {
      setScrapingUrl(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteDocument = async (document: Document) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('knowledge-base')
        .remove([document.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('knowledge_base_documents')
        .delete()
        .eq('id', document.id);

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Document deleted successfully",
      });

      loadDocuments();
    } catch (error: any) {
      console.error('Error deleting document:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button
              variant="ghost"
              onClick={() => navigate('/dashboard')}
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-xl font-semibold text-foreground">
              Knowledge Base - {client?.name}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Add to Knowledge Base</CardTitle>
              <CardDescription>
                Upload documents or scrape website content to enhance your AI agent's knowledge base
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="files" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="files">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Files
                  </TabsTrigger>
                  <TabsTrigger value="urls">
                    <Globe className="h-4 w-4 mr-2" />
                    Scrape Websites
                  </TabsTrigger>
                  <TabsTrigger value="crm">
                    <Database className="h-4 w-4 mr-2" />
                    CRM Data
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="files" className="space-y-4">
                  <div>
                    <Label htmlFor="file-upload">Choose File</Label>
                    <Input
                      id="file-upload"
                      type="file"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      accept=".txt,.json,.pdf,.doc,.docx"
                      className="mt-2"
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      Supported formats: TXT, JSON, PDF (coming soon), DOC (coming soon)
                    </p>
                  </div>
                  {uploading && (
                    <div className="space-y-2">
                      <Progress value={uploadProgress} />
                      <p className="text-sm text-muted-foreground">
                        Uploading and processing document...
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="urls" className="space-y-4">
                  <form onSubmit={handleUrlScraping} className="space-y-4">
                    <div>
                      <Label htmlFor="web-url">Website URL</Label>
                      <Input
                        id="web-url"
                        type="url"
                        value={webUrl}
                        onChange={(e) => setWebUrl(e.target.value)}
                        placeholder="https://example.com"
                        disabled={scrapingUrl}
                        className="mt-2"
                        required
                      />
                      <p className="text-sm text-muted-foreground mt-2">
                        Enter a website URL to scrape its content and add it to the knowledge base
                      </p>
                    </div>
                    <Button 
                      type="submit" 
                      disabled={scrapingUrl || !webUrl}
                      className="w-full sm:w-auto"
                    >
                      <Link className="h-4 w-4 mr-2" />
                      {scrapingUrl ? 'Scraping...' : 'Scrape Website'}
                    </Button>
                  </form>
                  {scrapingUrl && (
                    <div className="space-y-2">
                      <Progress value={uploadProgress} />
                      <p className="text-sm text-muted-foreground">
                        Scraping and processing website content...
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="crm" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-medium">CRM Integrations</h3>
                      <p className="text-sm text-muted-foreground">
                        Sync data from your connected CRM systems
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/clients/${clientId}/crm-integrations`)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Manage CRM
                    </Button>
                  </div>

                  {crmIntegrations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                      <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">No CRM integrations configured</p>
                      <p className="text-sm">Connect your CRM to sync customer data, deals, and support tickets</p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => navigate(`/clients/${clientId}/crm-integrations`)}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Set up CRM Integration
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {crmIntegrations.map((integration: any) => (
                        <div key={integration.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                          <div className="flex items-center space-x-4">
                            <Database className="h-8 w-8 text-muted-foreground" />
                            <div>
                              <h4 className="font-medium">{integration.name}</h4>
                              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                <Badge variant="outline">{integration.crm_type.toUpperCase()}</Badge>
                                <span>•</span>
                                <span>Status: {integration.sync_status}</span>
                                {integration.last_sync_at && (
                                  <>
                                    <span>•</span>
                                    <span>Last sync: {new Date(integration.last_sync_at).toLocaleString()}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleSyncCrm(integration.id)}
                            disabled={syncingCrm}
                            size="sm"
                          >
                            {syncingCrm ? 'Syncing...' : 'Sync Now'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Documents ({documents.length})</CardTitle>
            <CardDescription>
              Manage your knowledge base documents
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No documents uploaded yet.</p>
                <p className="text-sm">Upload your first document to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {documents.map((document) => (
                  <div key={document.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center space-x-4">
                      {document.source_type === 'url' ? (
                        <Globe className="h-8 w-8 text-muted-foreground" />
                      ) : document.source_type === 'crm' ? (
                        <Database className="h-8 w-8 text-muted-foreground" />
                      ) : (
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      )}
                      <div>
                        <h3 className="font-medium">{document.title}</h3>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          {document.source_type === 'url' ? (
                            <>
                              <span>Website: {document.source_url}</span>
                              <span>Scraped content</span>
                            </>
                          ) : document.source_type === 'crm' ? (
                            <>
                              <span>CRM: {document.crm_record_type}</span>
                              <Badge variant="secondary" className="text-xs">CRM Data</Badge>
                            </>
                          ) : (
                            <>
                              <span>{document.filename}</span>
                              <span>{formatFileSize(document.file_size)}</span>
                              <span>{document.file_type}</span>
                            </>
                          )}
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            document.processed 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}>
                            {document.processed ? 'Processed' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteDocument(document)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default KnowledgeBase;