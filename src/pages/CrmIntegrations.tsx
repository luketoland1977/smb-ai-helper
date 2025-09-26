import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Settings, Trash2, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

interface CrmIntegration {
  id: string;
  crm_type: 'hubspot' | 'salesforce' | 'pipedrive' | 'zoho';
  name: string;
  is_active: boolean;
  last_sync_at: string | null;
  sync_status: string;
  sync_error: string | null;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
}

const CrmIntegrations = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [integrations, setIntegrations] = useState<CrmIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    crm_type: '',
    name: '',
    api_key: '',
    api_secret: ''
  });

  useEffect(() => {
    if (clientId) {
      loadClient();
      loadIntegrations();
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
      navigate('/admin-panel');
      return;
    }

    setClient(data);
  };

  const loadIntegrations = async () => {
    if (!clientId) return;

    const { data, error } = await supabase
      .from('crm_integrations')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading CRM integrations:', error);
      toast({
        title: "Error",
        description: "Failed to load CRM integrations",
        variant: "destructive",
      });
    } else {
      setIntegrations(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !formData.crm_type || !formData.name || !formData.api_key) return;

    try {
      const { error } = await supabase
        .from('crm_integrations')
        .insert([{
          client_id: clientId,
          crm_type: formData.crm_type as any,
          name: formData.name,
          api_key: formData.api_key,
          api_secret: formData.api_secret || null,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "CRM integration added successfully",
      });

      setFormData({ crm_type: '', name: '', api_key: '', api_secret: '' });
      setShowForm(false);
      loadIntegrations();
    } catch (error: any) {
      console.error('Error adding CRM integration:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add CRM integration",
        variant: "destructive",
      });
    }
  };

  const handleSync = async (integration: CrmIntegration) => {
    try {
      const { error } = await supabase.functions
        .invoke('sync-crm-data', {
          body: { 
            integration_id: integration.id,
            client_id: clientId
          }
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "CRM sync started successfully",
      });

      loadIntegrations();
    } catch (error: any) {
      console.error('Error syncing CRM:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to start CRM sync",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (integration: CrmIntegration) => {
    try {
      const { error } = await supabase
        .from('crm_integrations')
        .delete()
        .eq('id', integration.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "CRM integration deleted successfully",
      });

      loadIntegrations();
    } catch (error: any) {
      console.error('Error deleting CRM integration:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete CRM integration",
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (integration: CrmIntegration) => {
    try {
      const { error } = await supabase
        .from('crm_integrations')
        .update({ is_active: !integration.is_active })
        .eq('id', integration.id);

      if (error) throw error;

      loadIntegrations();
    } catch (error: any) {
      console.error('Error updating CRM integration:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update CRM integration",
        variant: "destructive",
      });
    }
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
              onClick={() => navigate('/admin-panel')}
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-xl font-semibold text-foreground">
              CRM Integrations - {client?.name}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>CRM Integrations</CardTitle>
                  <CardDescription>
                    Connect your CRM systems to enhance your AI agent's knowledge base
                  </CardDescription>
                </div>
                <Button onClick={() => setShowForm(!showForm)}>
                  {showForm ? 'Cancel' : 'Add Integration'}
                </Button>
              </div>
            </CardHeader>
            {showForm && (
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="crm-type">CRM Type</Label>
                      <Select value={formData.crm_type} onValueChange={(value) => setFormData({...formData, crm_type: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select CRM type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hubspot">HubSpot</SelectItem>
                          <SelectItem value="salesforce">Salesforce</SelectItem>
                          <SelectItem value="pipedrive">Pipedrive</SelectItem>
                          <SelectItem value="zoho">Zoho</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="name">Integration Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="My HubSpot Integration"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="api-key">API Key</Label>
                      <Input
                        id="api-key"
                        type="password"
                        value={formData.api_key}
                        onChange={(e) => setFormData({...formData, api_key: e.target.value})}
                        placeholder="Enter API key"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="api-secret">API Secret (optional)</Label>
                      <Input
                        id="api-secret"
                        type="password"
                        value={formData.api_secret}
                        onChange={(e) => setFormData({...formData, api_secret: e.target.value})}
                        placeholder="Enter API secret if required"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full">
                    Add CRM Integration
                  </Button>
                </form>
              </CardContent>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Connected CRMs ({integrations.length})</CardTitle>
            <CardDescription>
              Manage your CRM integrations and sync data
            </CardDescription>
          </CardHeader>
          <CardContent>
            {integrations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No CRM integrations configured yet.</p>
                <p className="text-sm">Add your first CRM integration to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {integrations.map((integration) => (
                  <div key={integration.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        {integration.sync_status === 'success' ? (
                          <CheckCircle className="h-8 w-8 text-green-500" />
                        ) : integration.sync_status === 'error' ? (
                          <AlertCircle className="h-8 w-8 text-red-500" />
                        ) : (
                          <Settings className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium">{integration.name}</h3>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <Badge variant="outline">{integration.crm_type.toUpperCase()}</Badge>
                          <span>Status: {integration.sync_status}</span>
                          {integration.last_sync_at && (
                            <span>Last sync: {new Date(integration.last_sync_at).toLocaleString()}</span>
                          )}
                        </div>
                        {integration.sync_error && (
                          <p className="text-sm text-red-500 mt-1">{integration.sync_error}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor={`active-${integration.id}`} className="text-sm">Active</Label>
                        <Switch
                          id={`active-${integration.id}`}
                          checked={integration.is_active}
                          onCheckedChange={() => toggleActive(integration)}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSync(integration)}
                        disabled={!integration.is_active}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(integration)}
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

export default CrmIntegrations;