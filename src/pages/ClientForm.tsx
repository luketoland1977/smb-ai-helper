import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Trash2, CheckCircle, Bot, Phone, MessageSquare } from 'lucide-react';

const ClientForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    subdomain: ''
  });
  const [agentData, setAgentData] = useState({
    openai_api_key: '',
    system_prompt: 'You are a helpful AI assistant providing excellent customer service and support. Be friendly, professional, and helpful in all interactions.',
    template_type: 'general'
  });
  const [twilioData, setTwilioData] = useState({
    account_sid: '',
    auth_token: '',
    phone_number: ''
  });

  const isEditing = Boolean(id);

  useEffect(() => {
    if (isEditing) {
      loadClient();
    }
  }, [id, isEditing]);

  const loadClient = async () => {
    if (!id) return;
    
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load client data",
        variant: "destructive",
      });
      navigate('/dashboard');
      return;
    }

    if (data) {
      setFormData({
        name: data.name,
        domain: data.domain || '',
        subdomain: data.subdomain || ''
      });

      // Load default agent data
      const { data: agent } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('client_id', id)
        .eq('is_default', true)
        .single();

      if (agent) {
        setAgentData({
          openai_api_key: agent.openai_api_key || '',
          system_prompt: agent.system_prompt || agentData.system_prompt,
          template_type: agent.template_type || 'general'
        });
      }

      // Load Twilio data
      const { data: twilio } = await supabase
        .from('twilio_integrations')
        .select('*')
        .eq('client_id', id)
        .single();

      if (twilio) {
        setTwilioData({
          account_sid: twilio.account_sid || '',
          auth_token: '', // Don't load for security
          phone_number: twilio.phone_number || ''
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEditing) {
        // Update client
        const { error: clientError } = await supabase
          .from('clients')
          .update(formData)
          .eq('id', id);

        if (clientError) throw clientError;

        // Update default agent if OpenAI API key is provided
        if (agentData.openai_api_key) {
          const { data: agents } = await supabase
            .from('ai_agents')
            .select('id')
            .eq('client_id', id)
            .eq('is_default', true)
            .single();

          if (agents) {
            const { error: agentError } = await supabase
              .from('ai_agents')
              .update({
                openai_api_key: agentData.openai_api_key,
                system_prompt: agentData.system_prompt,
                template_type: agentData.template_type
              })
              .eq('id', agents.id);

            if (agentError) throw agentError;
          }
        }

        // Update Twilio integration if credentials are provided
        if (twilioData.account_sid && twilioData.phone_number) {
          const updateData: any = {
            client_id: id,
            account_sid: twilioData.account_sid,
            phone_number: twilioData.phone_number,
            is_active: true
          };

          if (twilioData.auth_token) {
            updateData.auth_token = twilioData.auth_token;
          }

          const { error: twilioError } = await supabase
            .from('twilio_integrations')
            .upsert([updateData]);

          if (twilioError) throw twilioError;
        }

        toast({
          title: "Success",
          description: "Client updated successfully",
        });
      } else {
        // Create client (auto-creation will handle agent and widgets)
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert([formData])
          .select()
          .single();

        if (clientError) throw clientError;

        // Update the auto-created agent with provided data
        if (agentData.openai_api_key) {
          const { error: agentError } = await supabase
            .from('ai_agents')
            .update({
              openai_api_key: agentData.openai_api_key,
              system_prompt: agentData.system_prompt,
              template_type: agentData.template_type
            })
            .eq('client_id', newClient.id)
            .eq('is_default', true);

          if (agentError) throw agentError;
        }

        // Create Twilio integration if credentials are provided
        if (twilioData.account_sid && twilioData.auth_token && twilioData.phone_number) {
          const { data: agent } = await supabase
            .from('ai_agents')
            .select('id')
            .eq('client_id', newClient.id)
            .eq('is_default', true)
            .single();

          if (agent) {
            const { error: twilioError } = await supabase
              .from('twilio_integrations')
              .insert([{
                client_id: newClient.id,
                agent_id: agent.id,
                account_sid: twilioData.account_sid,
                auth_token: twilioData.auth_token,
                phone_number: twilioData.phone_number,
                is_active: true
              }]);

            if (twilioError) throw twilioError;
          }
        }

        toast({
          title: "Success",
          description: "Client created successfully with complete setup",
        });
      }

      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error saving client:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save client",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    
    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client deleted successfully",
      });

      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error deleting client:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete client",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

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
              {isEditing ? 'Edit Client' : 'Create New Client'}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{isEditing ? 'Edit Client' : 'Create New Client'}</CardTitle>
            <CardDescription>
              {isEditing 
                ? 'Update client information and settings' 
                : 'Create a complete client environment with AI agent and communication channels'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">Client Info</TabsTrigger>
                  <TabsTrigger value="agent">AI Agent</TabsTrigger>
                  <TabsTrigger value="twilio">Phone (Twilio)</TabsTrigger>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                </TabsList>
                
                <TabsContent value="basic" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Client Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Acme Corporation"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="domain">Domain</Label>
                    <Input
                      id="domain"
                      value={formData.domain}
                      onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                      placeholder="e.g., acmecorp.com"
                    />
                    <p className="text-sm text-muted-foreground">
                      The primary domain where the AI agent will be deployed
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subdomain">Subdomain</Label>
                    <Input
                      id="subdomain"
                      value={formData.subdomain}
                      onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
                      placeholder="e.g., support"
                    />
                    <p className="text-sm text-muted-foreground">
                      Custom subdomain for dedicated support portal (optional)
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="agent" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="template_type">Agent Template</Label>
                    <Select value={agentData.template_type} onValueChange={(value) => setAgentData({ ...agentData, template_type: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General Customer Service</SelectItem>
                        <SelectItem value="sales">Sales & Support</SelectItem>
                        <SelectItem value="technical">Technical Support</SelectItem>
                        <SelectItem value="ecommerce">E-commerce</SelectItem>
                        <SelectItem value="healthcare">Healthcare</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="openai_api_key">OpenAI API Key</Label>
                    <Input
                      id="openai_api_key"
                      type="password"
                      value={agentData.openai_api_key}
                      onChange={(e) => setAgentData({ ...agentData, openai_api_key: e.target.value })}
                      placeholder="sk-..."
                    />
                    <p className="text-sm text-muted-foreground">
                      Required for AI agent functionality. Each client has their own isolated API key.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="system_prompt">System Prompt</Label>
                    <Textarea
                      id="system_prompt"
                      value={agentData.system_prompt}
                      onChange={(e) => setAgentData({ ...agentData, system_prompt: e.target.value })}
                      rows={6}
                      placeholder="Customize the AI agent's personality and behavior..."
                    />
                  </div>
                </TabsContent>

                <TabsContent value="twilio" className="space-y-4">
                  <div className="text-sm text-muted-foreground mb-4">
                    Configure Twilio for phone and SMS support. Each client gets their own isolated Twilio integration.
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="account_sid">Twilio Account SID</Label>
                    <Input
                      id="account_sid"
                      type="text"
                      value={twilioData.account_sid}
                      onChange={(e) => setTwilioData({ ...twilioData, account_sid: e.target.value })}
                      placeholder="AC..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="auth_token">Twilio Auth Token</Label>
                    <Input
                      id="auth_token"
                      type="password"
                      value={twilioData.auth_token}
                      onChange={(e) => setTwilioData({ ...twilioData, auth_token: e.target.value })}
                      placeholder="Your Twilio auth token"
                    />
                    {isEditing && (
                      <p className="text-sm text-muted-foreground">
                        Leave blank to keep existing auth token
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone_number">Twilio Phone Number</Label>
                    <Input
                      id="phone_number"
                      type="text"
                      value={twilioData.phone_number}
                      onChange={(e) => setTwilioData({ ...twilioData, phone_number: e.target.value })}
                      placeholder="+1234567890"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="summary" className="space-y-4">
                  <div className="bg-muted p-6 rounded-lg">
                    <h3 className="font-semibold mb-4 flex items-center">
                      <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                      What will be created:
                    </h3>
                    <div className="grid gap-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        <span className="text-sm">Client profile with domain configuration</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Bot className="h-4 w-4 text-primary" />
                        <span className="text-sm">Default AI agent with {agentData.template_type} template</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <span className="text-sm">Chat widget with embed code</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                        <span className="text-sm">Voice widget with real-time audio</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        <span className="text-sm">Knowledge base ready for content</span>
                      </div>
                      {twilioData.phone_number && (
                        <div className="flex items-center space-x-3">
                          <Phone className="h-4 w-4 text-primary" />
                          <span className="text-sm">Phone integration with Twilio</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        <span className="text-sm">Unified management dashboard</span>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-between">
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/dashboard')}
                    disabled={loading || deleteLoading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading || deleteLoading}>
                    {loading 
                      ? (isEditing ? 'Updating...' : 'Creating...') 
                      : (isEditing ? 'Update Client' : 'Create Complete Setup')
                    }
                  </Button>
                </div>

                {isEditing && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        type="button" 
                        variant="destructive"
                        disabled={loading || deleteLoading}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Client
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Client</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{formData.name}"? This will also delete all associated AI agents, chat sessions, widgets, and data. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          disabled={deleteLoading}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deleteLoading ? 'Deleting...' : 'Delete Client'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ClientForm;