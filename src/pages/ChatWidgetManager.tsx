import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Copy, ExternalLink, Settings, MessageCircle, Phone, MessageSquare } from 'lucide-react';
import VoiceInterface from '@/components/VoiceInterface';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface ChatWidget {
  id: string;
  client_id: string;
  agent_id: string;
  widget_name: string;
  widget_config: any;
  embed_code: string;
  is_active: boolean;
  created_at: string;
}

interface VoiceWidget {
  id: string;
  client_id: string;
  agent_id: string;
  widget_name: string;
  voice_settings: any;
  widget_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TwilioIntegration {
  id: string;
  client_id: string;
  agent_id: string;
  account_sid: string;
  phone_number: string;
  is_active: boolean;
  sms_enabled: boolean;
  voice_enabled: boolean;
  voice_settings: any;
  created_at: string;
  updated_at: string;
}

interface Agent {
  id: string;
  name: string;
  status: string;
  client_id: string;
}

interface Client {
  id: string;
  name: string;
  domain: string;
}

const ChatWidgetManager = () => {
  const { toast } = useToast();
  const [widgets, setWidgets] = useState<ChatWidget[]>([]);
  const [voiceWidgets, setVoiceWidgets] = useState<VoiceWidget[]>([]);
  const [twilioIntegrations, setTwilioIntegrations] = useState<TwilioIntegration[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showVoiceForm, setShowVoiceForm] = useState(false);
  const [showTwilioForm, setShowTwilioForm] = useState(false);
  const [showTwilioEditForm, setShowTwilioEditForm] = useState(false);
  const [editingTwilioIntegration, setEditingTwilioIntegration] = useState<TwilioIntegration | null>(null);
  const [lastCreatedWidget, setLastCreatedWidget] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    client_id: '',
    agent_id: '',
    widget_name: '',
    primary_color: '#2563eb',
    welcome_message: 'Hello! How can I help you today?',
    position: 'bottom-right',
    size: 'medium',
  });

  const [voiceFormData, setVoiceFormData] = useState({
    client_id: '',
    agent_id: '',
    widget_name: '',
    position: 'bottom-right',
    primary_color: '#2563eb',
    system_prompt: 'You are a helpful voice assistant.',
    voice_rate: 0.9,
    voice_pitch: 1.0,
  });

  const [twilioFormData, setTwilioFormData] = useState({
    client_id: '',
    agent_id: '',
    account_sid: '',
    auth_token: '',
    phone_number: '',
    sms_enabled: true,
    voice_enabled: true,
    voice: 'alice',
    language: 'en-US',
    welcome_message: '',
    follow_up_message: '',
  });

  // Form validation state
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name, domain')
        .order('name');

      if (clientsData) setClients(clientsData);

      // Load agents
      const { data: agentsData } = await supabase
        .from('ai_agents')
        .select('id, name, status, client_id')
        .eq('status', 'active')
        .order('name');

      if (agentsData) setAgents(agentsData);

      // Load existing widgets
      const { data: widgetsData } = await supabase
        .from('chat_widgets')
        .select('*')
        .order('created_at', { ascending: false });
      if (widgetsData) setWidgets(widgetsData);

      // Load voice widgets
      const { data: voiceWidgetsData } = await supabase
        .from('voice_widgets')
        .select('*')
        .order('created_at', { ascending: false });
      if (voiceWidgetsData) setVoiceWidgets(voiceWidgetsData);

      // Load Twilio integrations
      const { data: twilioData } = await supabase
        .from('twilio_integrations')
        .select('*')
        .order('created_at', { ascending: false });
      if (twilioData) setTwilioIntegrations(twilioData as any);
      
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateEmbedCode = (clientId: string, agentId: string, config: any) => {
    const baseUrl = window.location.origin;
    return `<!-- AI Service Pro Chat Widget -->
<div id="ai-service-chat-widget"></div>
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${baseUrl}/widget.js';
    script.dataset.clientId = '${clientId}';
    script.dataset.agentId = '${agentId}';
    script.dataset.config = '${JSON.stringify(config)}';
    script.async = true;
    document.head.appendChild(script);
  })();
</script>`;
  };

  const generateVoiceEmbedCode = (clientId: string, agentId: string, config: any) => {
    const baseUrl = window.location.origin;
    return `<!-- AI Service Pro Voice Widget -->
<script>
  window.voiceWidgetConfig = {
    clientId: '${clientId}',
    agentId: '${agentId}',
    position: '${config.position}',
    primaryColor: '${config.primaryColor}',
    systemPrompt: '${config.systemPrompt}',
    apiUrl: 'https://ycvvuepfsebqpwmamqgg.functions.supabase.co/functions/v1'
  };
</script>
<script src="${baseUrl}/voice-widget.js"></script>`;
  };

  const generateWebhookUrls = () => {
    return {
      voice: 'https://nodejs-production-3c84.up.railway.app/incoming-call',
      sms: 'https://ycvvuepfsebqpwmamqgg.functions.supabase.co/functions/v1/twilio-sms-webhook'
    };
  };

  const handleCreateWidget = async () => {
    if (!formData.client_id || !formData.agent_id || !formData.widget_name) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const config = {
      primaryColor: formData.primary_color,
      welcomeMessage: formData.welcome_message,
      position: formData.position,
      size: formData.size
    };

    const embedCode = generateEmbedCode(formData.client_id, formData.agent_id, config);

    try {
      const { data, error } = await supabase
        .from('chat_widgets')
        .insert([{
          client_id: formData.client_id,
          agent_id: formData.agent_id,
          widget_name: formData.widget_name,
          widget_config: config,
          embed_code: embedCode,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Widget Created",
        description: "Your chat widget has been created successfully.",
      });

      // Refresh data
      loadData();
      setShowCreateForm(false);
      
      // Reset form
      setFormData({
        client_id: '',
        agent_id: '',
        widget_name: '',
        primary_color: '#2563eb',
        welcome_message: 'Hello! How can I help you today?',
        position: 'bottom-right',
        size: 'medium'
      });
      
    } catch (error) {
      console.error('Error creating widget:', error);
      toast({
        title: "Error",
        description: "Failed to create widget",
        variant: "destructive",
      });
    }
  };

  const handleCreateVoiceWidget = async () => {
    if (!voiceFormData.client_id || !voiceFormData.agent_id || !voiceFormData.widget_name) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const config = {
      position: voiceFormData.position,
      primaryColor: voiceFormData.primary_color,
      systemPrompt: voiceFormData.system_prompt,
      voiceRate: voiceFormData.voice_rate,
      voicePitch: voiceFormData.voice_pitch,
    };

    const embedCode = generateVoiceEmbedCode(voiceFormData.client_id, voiceFormData.agent_id, config);

    try {
      const { data, error } = await supabase
        .from('voice_widgets')
        .insert([{
          client_id: voiceFormData.client_id,
          agent_id: voiceFormData.agent_id,
          widget_name: voiceFormData.widget_name,
          voice_settings: config,
          widget_code: embedCode,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Voice Widget Created",
        description: "Your voice widget has been configured successfully.",
      });

      // Refresh data
      loadData();
      setShowVoiceForm(false);
      
      // Reset form
      setVoiceFormData({
        client_id: '',
        agent_id: '',
        widget_name: '',
        position: 'bottom-right',
        primary_color: '#2563eb',
        system_prompt: 'You are a helpful voice assistant.',
        voice_rate: 0.9,
        voice_pitch: 1.0,
      });
      
    } catch (error) {
      console.error('Error creating voice widget:', error);
      toast({
        title: "Error",
        description: "Failed to create voice widget",
        variant: "destructive",
      });
    }
  };

  const createTwilioIntegration = async () => {
    // Validate required fields
    const errors: {[key: string]: string} = {};
    
    if (!twilioFormData.client_id) errors.client_id = 'Please select a client';
    if (!twilioFormData.agent_id) errors.agent_id = 'Please select an agent';
    if (!twilioFormData.phone_number) errors.phone_number = 'Phone number is required';
    if (!twilioFormData.account_sid) errors.account_sid = 'Twilio Account SID is required';
    if (!twilioFormData.auth_token) errors.auth_token = 'Twilio Auth Token is required';
    
    // Validate phone number format
    if (twilioFormData.phone_number && !twilioFormData.phone_number.match(/^\+[1-9]\d{1,14}$/)) {
      errors.phone_number = 'Phone number must be in E.164 format (e.g., +1234567890)';
    }
    
    // Validate Account SID format
    if (twilioFormData.account_sid && !twilioFormData.account_sid.match(/^AC[a-f0-9]{32}$/)) {
      errors.account_sid = 'Account SID must start with "AC" followed by 32 characters';
    }

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      toast({
        title: "Validation Error",
        description: "Please fix the highlighted fields",
        variant: "destructive",
      });
      return;
    }

    // Generate webhook URLs
    const webhookUrls = generateWebhookUrls();

    try {
      const { data, error } = await supabase
        .from('twilio_integrations')
        .insert({
          client_id: twilioFormData.client_id,
          agent_id: twilioFormData.agent_id,
          account_sid: twilioFormData.account_sid,
          auth_token: twilioFormData.auth_token,
          phone_number: twilioFormData.phone_number,
          webhook_url: webhookUrls.voice,
          sms_enabled: twilioFormData.sms_enabled,
          voice_enabled: twilioFormData.voice_enabled,
          voice_settings: {
            voice: twilioFormData.voice,
            language: twilioFormData.language,
            welcome_message: twilioFormData.welcome_message,
            follow_up_message: twilioFormData.follow_up_message,
            railway_url: 'https://nodejs-production-3c84.up.railway.app'
          }
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Phone Integration Created",
        description: (
          <div className="space-y-2">
            <p>Phone integration configured for {twilioFormData.phone_number}</p>
            <p className="text-xs bg-blue-50 p-2 rounded">
              📞 Don't forget to configure webhooks in your Twilio Console!<br/>
              Voice URL: {generateWebhookUrls().voice}<br/>
              SMS URL: {generateWebhookUrls().sms}
            </p>
          </div>
        ),
      });

      // Clear form errors and data
      setFormErrors({});
      loadData();
      setShowTwilioForm(false);
      setTwilioFormData({
        client_id: '',
        agent_id: '',
        account_sid: '',
        auth_token: '',
        phone_number: '',
        sms_enabled: true,
        voice_enabled: true,
        voice: 'alice',
        language: 'en-US',
        welcome_message: '',
        follow_up_message: '',
      });

    } catch (error) {
      console.error('Error creating Twilio integration:', error);
      toast({
        title: "Error",
        description: `Failed to create phone integration: ${error.message || error}`,
        variant: "destructive",
      });
    }
  };

  const handleEditTwilioIntegration = (integration: TwilioIntegration) => {
    setEditingTwilioIntegration(integration);
    setTwilioFormData({
      client_id: integration.client_id,
      agent_id: integration.agent_id,
      account_sid: integration.account_sid,
      auth_token: '', // Don't pre-fill the auth token for security
      phone_number: integration.phone_number,
      sms_enabled: integration.sms_enabled,
      voice_enabled: integration.voice_enabled,
      voice: integration.voice_settings?.voice || 'alice',
      language: integration.voice_settings?.language || 'en-US',
      welcome_message: integration.voice_settings?.welcome_message || '',
      follow_up_message: integration.voice_settings?.follow_up_message || '',
    });
    setShowTwilioEditForm(true);
  };

  const updateTwilioIntegration = async () => {
    if (!editingTwilioIntegration) return;

    // Validate required fields
    const errors: {[key: string]: string} = {};
    
    if (!twilioFormData.client_id) errors.client_id = 'Please select a client';
    if (!twilioFormData.agent_id) errors.agent_id = 'Please select an agent';
    if (!twilioFormData.phone_number) errors.phone_number = 'Phone number is required';
    if (!twilioFormData.account_sid) errors.account_sid = 'Twilio Account SID is required';
    if (!twilioFormData.auth_token) errors.auth_token = 'Twilio Auth Token is required';
    
    // Validate phone number format
    if (twilioFormData.phone_number && !twilioFormData.phone_number.match(/^\+[1-9]\d{1,14}$/)) {
      errors.phone_number = 'Phone number must be in E.164 format (e.g., +1234567890)';
    }
    
    // Validate Account SID format
    if (twilioFormData.account_sid && !twilioFormData.account_sid.match(/^AC[a-f0-9]{32}$/)) {
      errors.account_sid = 'Account SID must start with "AC" followed by 32 characters';
    }

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      toast({
        title: "Validation Error",
        description: "Please fix the highlighted fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('twilio_integrations')
        .update({
          client_id: twilioFormData.client_id,
          agent_id: twilioFormData.agent_id,
          account_sid: twilioFormData.account_sid,
          auth_token: twilioFormData.auth_token,
          phone_number: twilioFormData.phone_number,
          sms_enabled: twilioFormData.sms_enabled,
          voice_enabled: twilioFormData.voice_enabled,
          voice_settings: {
            voice: twilioFormData.voice,
            language: twilioFormData.language,
            welcome_message: twilioFormData.welcome_message,
            follow_up_message: twilioFormData.follow_up_message,
            railway_url: 'https://nodejs-production-3c84.up.railway.app'
          }
        })
        .eq('id', editingTwilioIntegration.id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Integration Updated",
        description: `Phone integration for ${twilioFormData.phone_number} has been updated successfully.`,
      });

      // Clear form errors and data
      setFormErrors({});
      setEditingTwilioIntegration(null);
      loadData();
      setShowTwilioEditForm(false);
      setTwilioFormData({
        client_id: '',
        agent_id: '',
        account_sid: '',
        auth_token: '',
        phone_number: '',
        sms_enabled: true,
        voice_enabled: true,
        voice: 'alice',
        language: 'en-US',
        welcome_message: '',
        follow_up_message: '',
      });

    } catch (error) {
      console.error('Error updating Twilio integration:', error);
      toast({
        title: "Error",
        description: `Failed to update phone integration: ${error.message || error}`,
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Code copied to clipboard",
    });
  };

  const handleDeleteWidget = async (widgetId: string) => {
    try {
      const { error } = await supabase
        .from('chat_widgets')
        .delete()
        .eq('id', widgetId);

      if (error) throw error;

      setWidgets(widgets.filter(w => w.id !== widgetId));
      toast({
        title: "Success",
        description: "Chat widget deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting widget:', error);
      toast({
        title: "Error",
        description: "Failed to delete chat widget",
        variant: "destructive",
      });
    }
  };

  const handleDeleteVoiceWidget = async (widgetId: string) => {
    try {
      const { error } = await supabase
        .from('voice_widgets')
        .delete()
        .eq('id', widgetId);

      if (error) throw error;

      setVoiceWidgets(voiceWidgets.filter(w => w.id !== widgetId));
      toast({
        title: "Success",
        description: "Voice widget deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting voice widget:', error);
      toast({
        title: "Error",
        description: "Failed to delete voice widget",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTwilioIntegration = async (integrationId: string) => {
    try {
      const { error } = await supabase
        .from('twilio_integrations')
        .delete()
        .eq('id', integrationId);

      if (error) throw error;

      setTwilioIntegrations(twilioIntegrations.filter(t => t.id !== integrationId));
      toast({
        title: "Success",
        description: "Phone integration deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting Twilio integration:', error);
      toast({
        title: "Error",
        description: "Failed to delete phone integration",
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
      <header className="bg-background/80 backdrop-blur-md border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Widget Manager</h1>
              <p className="text-muted-foreground mt-1">Create and manage your AI widgets and integrations</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="chat" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chat">
              <MessageCircle className="h-4 w-4 mr-2" />
              Chat Widgets
            </TabsTrigger>
            <TabsTrigger value="voice">
              <MessageSquare className="h-4 w-4 mr-2" />
              Voice Widgets
            </TabsTrigger>
            <TabsTrigger value="phone">
              <Phone className="h-4 w-4 mr-2" />
              Phone Integration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="space-y-6">
            {showCreateForm && (
              <Card>
                <CardHeader>
                  <CardTitle>Create Chat Widget</CardTitle>
                  <CardDescription>Configure your AI chat widget</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="client">Client</Label>
                      <select
                        id="client"
                        value={formData.client_id}
                        onChange={(e) => setFormData({...formData, client_id: e.target.value})}
                        className="w-full p-2 border rounded"
                      >
                        <option value="">Select a client</option>
                        {clients.map(client => (
                          <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="agent">AI Agent</Label>
                      <select
                        id="agent"
                        value={formData.agent_id}
                        onChange={(e) => setFormData({...formData, agent_id: e.target.value})}
                        className="w-full p-2 border rounded"
                      >
                        <option value="">Select an agent</option>
                        {agents.filter(agent => agent.client_id === formData.client_id).map(agent => (
                          <option key={agent.id} value={agent.id}>{agent.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="widget-name">Widget Name</Label>
                    <Input
                      id="widget-name"
                      placeholder="My Chat Widget"
                      value={formData.widget_name}
                      onChange={(e) => setFormData({...formData, widget_name: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="primary-color">Primary Color</Label>
                      <Input
                        id="primary-color"
                        type="color"
                        value={formData.primary_color}
                        onChange={(e) => setFormData({...formData, primary_color: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="position">Position</Label>
                      <select
                        id="position"
                        value={formData.position}
                        onChange={(e) => setFormData({...formData, position: e.target.value})}
                        className="w-full p-2 border rounded"
                      >
                        <option value="bottom-right">Bottom Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="top-right">Top Right</option>
                        <option value="top-left">Top Left</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="welcome-message">Welcome Message</Label>
                      <Textarea
                        id="welcome-message"
                        placeholder="Hello! How can I help you today?"
                        value={formData.welcome_message}
                        onChange={(e) => setFormData({...formData, welcome_message: e.target.value})}
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label htmlFor="size">Widget Size</Label>
                      <select
                        id="size"
                        value={formData.size}
                        onChange={(e) => setFormData({...formData, size: e.target.value})}
                        className="w-full p-2 border rounded"
                      >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleCreateWidget}>
                      Create Widget
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Chat Widgets</h2>
              <Button onClick={() => setShowCreateForm(true)}>
                Create Chat Widget
              </Button>
            </div>

            <div className="grid gap-6">
              {widgets.length === 0 ? (
                <Card>
                  <CardContent className="p-6">
                    <p className="text-center text-muted-foreground">
                      No chat widgets created yet.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                widgets.map((widget) => (
                  <Card key={widget.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {widget.widget_name}
                            <Badge variant={widget.is_active ? "default" : "secondary"}>
                              {widget.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </CardTitle>
                          <CardDescription>
                            Created {new Date(widget.created_at).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(widget.embed_code)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteWidget(widget.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">Widget Configuration</h4>
                          <div className="bg-muted p-3 rounded text-sm">
                            <p><strong>Primary Color:</strong> {widget.widget_config?.primaryColor || '#2563eb'}</p>
                            <p><strong>Position:</strong> {widget.widget_config?.position || 'bottom-right'}</p>
                            <p><strong>Size:</strong> {widget.widget_config?.size || 'medium'}</p>
                            <p><strong>Welcome Message:</strong> {widget.widget_config?.welcomeMessage || 'Hello! How can I help you today?'}</p>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium mb-2">Embed Code</h4>
                          <pre className="bg-muted p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap">
                            {widget.embed_code}
                          </pre>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="voice" className="space-y-6">
            {showVoiceForm && (
              <Card>
                <CardHeader>
                  <CardTitle>Create Voice Widget</CardTitle>
                  <CardDescription>Configure your voice assistant widget</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="voice-client">Client</Label>
                      <select
                        id="voice-client"
                        value={voiceFormData.client_id}
                        onChange={(e) => setVoiceFormData({...voiceFormData, client_id: e.target.value})}
                        className="w-full p-2 border rounded"
                      >
                        <option value="">Select a client</option>
                        {clients.map(client => (
                          <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="voice-agent">AI Agent</Label>
                      <select
                        id="voice-agent"
                        value={voiceFormData.agent_id}
                        onChange={(e) => setVoiceFormData({...voiceFormData, agent_id: e.target.value})}
                        className="w-full p-2 border rounded"
                      >
                        <option value="">Select an agent</option>
                        {agents.filter(agent => agent.client_id === voiceFormData.client_id).map(agent => (
                          <option key={agent.id} value={agent.id}>{agent.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="voice-widget-name">Widget Name</Label>
                    <Input
                      id="voice-widget-name"
                      placeholder="My Voice Widget"
                      value={voiceFormData.widget_name}
                      onChange={(e) => setVoiceFormData({...voiceFormData, widget_name: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="voice-position">Position</Label>
                      <select
                        id="voice-position"
                        value={voiceFormData.position}
                        onChange={(e) => setVoiceFormData({...voiceFormData, position: e.target.value})}
                        className="w-full p-2 border rounded"
                      >
                        <option value="bottom-right">Bottom Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="top-right">Top Right</option>
                        <option value="top-left">Top Left</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="voice-primary-color">Primary Color</Label>
                      <Input
                        id="voice-primary-color"
                        type="color"
                        value={voiceFormData.primary_color}
                        onChange={(e) => setVoiceFormData({...voiceFormData, primary_color: e.target.value})}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="voice-system-prompt">System Prompt</Label>
                    <Textarea
                      id="voice-system-prompt"
                      placeholder="You are a helpful voice assistant..."
                      value={voiceFormData.system_prompt}
                      onChange={(e) => setVoiceFormData({...voiceFormData, system_prompt: e.target.value})}
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleCreateVoiceWidget}>
                      Create Voice Widget
                    </Button>
                    <Button variant="outline" onClick={() => setShowVoiceForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Voice Widgets</h2>
              <Button onClick={() => setShowVoiceForm(true)}>
                Create Voice Widget
              </Button>
            </div>

            <div className="grid gap-6">
              {voiceWidgets.length === 0 ? (
                <Card>
                  <CardContent className="p-6">
                    <p className="text-center text-muted-foreground">
                      No voice widgets created yet.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                voiceWidgets.map((widget) => (
                  <Card key={widget.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {widget.widget_name}
                            <Badge variant={widget.is_active ? "default" : "secondary"}>
                              {widget.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </CardTitle>
                          <CardDescription>
                            Created {new Date(widget.created_at).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(widget.widget_code || '')}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteVoiceWidget(widget.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">Voice Widget Settings</h4>
                          <div className="bg-muted p-3 rounded text-sm">
                            <p><strong>Position:</strong> {widget.voice_settings?.position || 'bottom-right'}</p>
                            <p><strong>Primary Color:</strong> {widget.voice_settings?.primaryColor || '#2563eb'}</p>
                            <p><strong>System Prompt:</strong> {widget.voice_settings?.systemPrompt || 'You are a helpful voice assistant.'}</p>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium mb-2">Embed Code</h4>
                          <pre className="bg-muted p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap">
                            {widget.widget_code}
                          </pre>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="phone" className="space-y-6">
            {showTwilioForm && (
              <Card>
                <CardHeader>
                  <CardTitle>Create Phone Integration</CardTitle>
                  <CardDescription>
                    Connect Twilio for SMS and voice calls. This integration will use the OpenAI API key configured in your selected AI agent.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                      <h4 className="font-medium text-amber-900">Required Credentials</h4>
                    </div>
                    <p className="text-sm text-amber-800 mb-2">
                      For phone integration to work, you need:
                    </p>
                    <ul className="text-sm text-amber-800 list-disc list-inside space-y-1">
                      <li><strong>OpenAI API Key:</strong> Configure this in your AI Agent settings</li>
                      <li><strong>Twilio Credentials:</strong> Account SID and Auth Token from your Twilio console</li>
                      <li><strong>Phone Number:</strong> A Twilio phone number you've purchased</li>
                    </ul>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="twilio-client">Client *</Label>
                      <select
                        id="twilio-client"
                        value={twilioFormData.client_id}
                        onChange={(e) => setTwilioFormData({...twilioFormData, client_id: e.target.value})}
                        className={`w-full p-2 border rounded ${formErrors.client_id ? "border-red-500" : ""}`}
                      >
                        <option value="">Select a client</option>
                        {clients.map(client => (
                          <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
                      </select>
                      {formErrors.client_id && (
                        <p className="text-red-500 text-xs mt-1">{formErrors.client_id}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="twilio-agent">AI Agent *</Label>
                      <select
                        id="twilio-agent"
                        value={twilioFormData.agent_id}
                        onChange={(e) => setTwilioFormData({...twilioFormData, agent_id: e.target.value})}
                        className={`w-full p-2 border rounded ${formErrors.agent_id ? "border-red-500" : ""}`}
                      >
                        <option value="">Select an agent</option>
                        {agents.filter(agent => agent.client_id === twilioFormData.client_id).map(agent => (
                          <option key={agent.id} value={agent.id}>{agent.name}</option>
                        ))}
                      </select>
                      {formErrors.agent_id && (
                        <p className="text-red-500 text-xs mt-1">{formErrors.agent_id}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label htmlFor="account-sid">Twilio Account SID *</Label>
                      <Input
                        id="account-sid"
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={twilioFormData.account_sid}
                        onChange={(e) => setTwilioFormData({...twilioFormData, account_sid: e.target.value})}
                        className={formErrors.account_sid ? "border-red-500" : ""}
                      />
                      {formErrors.account_sid && (
                        <p className="text-red-500 text-xs mt-1">{formErrors.account_sid}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="auth-token">Twilio Auth Token *</Label>
                      <Input
                        id="auth-token"
                        type="password"
                        placeholder="Enter your Twilio Auth Token"
                        value={twilioFormData.auth_token}
                        onChange={(e) => setTwilioFormData({...twilioFormData, auth_token: e.target.value})}
                        className={formErrors.auth_token ? "border-red-500" : ""}
                      />
                      {formErrors.auth_token && (
                        <p className="text-red-500 text-xs mt-1">{formErrors.auth_token}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        ⚠️ Keep this secure! Find it in Twilio Console → Settings → API Keys & Tokens
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="phone-number">Phone Number *</Label>
                      <Input
                        id="phone-number"
                        placeholder="+1234567890"
                        value={twilioFormData.phone_number}
                        onChange={(e) => setTwilioFormData({...twilioFormData, phone_number: e.target.value})}
                        className={formErrors.phone_number ? "border-red-500" : ""}
                      />
                      {formErrors.phone_number && (
                        <p className="text-red-500 text-xs mt-1">{formErrors.phone_number}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Must be in E.164 format (e.g., +1234567890)
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="sms-enabled"
                        checked={twilioFormData.sms_enabled}
                        onChange={(e) => setTwilioFormData({...twilioFormData, sms_enabled: e.target.checked})}
                      />
                      <Label htmlFor="sms-enabled">Enable SMS</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="voice-enabled"
                        checked={twilioFormData.voice_enabled}
                        onChange={(e) => setTwilioFormData({...twilioFormData, voice_enabled: e.target.checked})}
                      />
                      <Label htmlFor="voice-enabled">Enable Voice Calls</Label>
                    </div>
                  </div>

                  {twilioFormData.voice_enabled && (
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <h4 className="font-medium text-blue-900">Voice Powered by ElevenLabs</h4>
                        </div>
                        <p className="text-sm text-blue-800">
                          Voice calls now use ElevenLabs AI with the high-quality "Aria" voice for natural, professional conversations. 
                          The Twilio voice settings have been replaced with ElevenLabs for superior audio quality.
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="language">Language</Label>
                        <select
                          id="language"
                          value={twilioFormData.language}
                          onChange={(e) => setTwilioFormData({...twilioFormData, language: e.target.value})}
                          className="w-full p-2 border rounded"
                        >
                          <option value="en-US">English (US)</option>
                          <option value="en-GB">English (UK)</option>
                          <option value="es-ES">Spanish</option>
                          <option value="fr-FR">French</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="welcome-message">Welcome Message</Label>
                    <Textarea
                      id="welcome-message"
                      placeholder="Welcome! How can I help you today?"
                      value={twilioFormData.welcome_message}
                      onChange={(e) => setTwilioFormData({...twilioFormData, welcome_message: e.target.value})}
                      rows={2}
                    />
                  </div>

                  <div className="border-t pt-4">
                    <div className="mb-3">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        📞 Webhook Setup Required
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        After creating this integration, you'll need to configure these webhook URLs in your Twilio Console:
                      </p>
                    </div>
                    
                    <div className="space-y-3 bg-muted p-4 rounded-lg">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Voice Webhook URL:</label>
                        <div className="mt-1 p-2 bg-background border rounded font-mono text-xs">
                          {generateWebhookUrls().voice}
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">SMS Webhook URL:</label>
                        <div className="mt-1 p-2 bg-background border rounded font-mono text-xs">
                          {generateWebhookUrls().sms}
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground mt-2">
                      💡 Go to: Twilio Console → Phone Numbers → Manage → Active Numbers → Select your number → Configure webhooks
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={createTwilioIntegration}>
                      Create Integration
                    </Button>
                    <Button variant="outline" onClick={() => setShowTwilioForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {showTwilioEditForm && editingTwilioIntegration && (
              <Card>
                <CardHeader>
                  <CardTitle>Edit Phone Integration</CardTitle>
                  <CardDescription>Update your Twilio phone integration settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-client">Client</Label>
                      <select
                        id="edit-client"
                        value={twilioFormData.client_id}
                        onChange={(e) => setTwilioFormData({...twilioFormData, client_id: e.target.value})}
                        className={`w-full p-2 border rounded ${formErrors.client_id ? "border-red-500" : ""}`}
                      >
                        <option value="">Select a client</option>
                        {clients.map(client => (
                          <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
                      </select>
                      {formErrors.client_id && (
                        <p className="text-red-500 text-xs mt-1">{formErrors.client_id}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="edit-agent">AI Agent</Label>
                      <select
                        id="edit-agent"
                        value={twilioFormData.agent_id}
                        onChange={(e) => setTwilioFormData({...twilioFormData, agent_id: e.target.value})}
                        className={`w-full p-2 border rounded ${formErrors.agent_id ? "border-red-500" : ""}`}
                      >
                        <option value="">Select an agent</option>
                        {agents.filter(agent => agent.client_id === twilioFormData.client_id).map(agent => (
                          <option key={agent.id} value={agent.id}>{agent.name}</option>
                        ))}
                      </select>
                      {formErrors.agent_id && (
                        <p className="text-red-500 text-xs mt-1">{formErrors.agent_id}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-account-sid">Twilio Account SID *</Label>
                      <Input
                        id="edit-account-sid"
                        placeholder="AC..."
                        value={twilioFormData.account_sid}
                        onChange={(e) => setTwilioFormData({...twilioFormData, account_sid: e.target.value})}
                        className={formErrors.account_sid ? "border-red-500" : ""}
                      />
                      {formErrors.account_sid && (
                        <p className="text-red-500 text-xs mt-1">{formErrors.account_sid}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Find this in Twilio Console → Settings → General
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="edit-auth-token">Twilio Auth Token *</Label>
                      <Input
                        id="edit-auth-token"
                        type="password"
                        placeholder="Enter new auth token..."
                        value={twilioFormData.auth_token}
                        onChange={(e) => setTwilioFormData({...twilioFormData, auth_token: e.target.value})}
                        className={formErrors.auth_token ? "border-red-500" : ""}
                      />
                      {formErrors.auth_token && (
                        <p className="text-red-500 text-xs mt-1">{formErrors.auth_token}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        ⚠️ Enter your new auth token to update
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="edit-phone-number">Phone Number *</Label>
                    <Input
                      id="edit-phone-number"
                      placeholder="+1234567890"
                      value={twilioFormData.phone_number}
                      onChange={(e) => setTwilioFormData({...twilioFormData, phone_number: e.target.value})}
                      className={formErrors.phone_number ? "border-red-500" : ""}
                    />
                    {formErrors.phone_number && (
                      <p className="text-red-500 text-xs mt-1">{formErrors.phone_number}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="edit-sms-enabled"
                        checked={twilioFormData.sms_enabled}
                        onChange={(e) => setTwilioFormData({...twilioFormData, sms_enabled: e.target.checked})}
                      />
                      <Label htmlFor="edit-sms-enabled">Enable SMS</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="edit-voice-enabled"
                        checked={twilioFormData.voice_enabled}
                        onChange={(e) => setTwilioFormData({...twilioFormData, voice_enabled: e.target.checked})}
                      />
                      <Label htmlFor="edit-voice-enabled">Enable Voice Calls</Label>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="edit-welcome-message">Welcome Message</Label>
                    <Textarea
                      id="edit-welcome-message"
                      placeholder="Welcome! How can I help you today?"
                      value={twilioFormData.welcome_message}
                      onChange={(e) => setTwilioFormData({...twilioFormData, welcome_message: e.target.value})}
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={updateTwilioIntegration}>
                      Update Integration
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowTwilioEditForm(false);
                        setEditingTwilioIntegration(null);
                        setFormErrors({});
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Phone Integrations</h2>
              <Button onClick={() => setShowTwilioForm(true)}>
                Create Phone Integration
              </Button>
            </div>

            <div className="grid gap-6">
              {twilioIntegrations.length === 0 ? (
                <Card>
                  <CardContent className="p-6">
                    <p className="text-center text-muted-foreground">
                      No phone integrations created yet. Create one to enable SMS and voice call support.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                twilioIntegrations.map((integration) => (
                  <Card key={integration.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {integration.phone_number}
                            <Badge variant={integration.is_active ? "default" : "secondary"}>
                              {integration.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </CardTitle>
                          <CardDescription>
                            Created {new Date(integration.created_at).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditTwilioIntegration(integration)}
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteTwilioIntegration(integration.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                     <CardContent>
                       <div className="space-y-4">
                         <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p><strong>SMS:</strong> {integration.sms_enabled ? 'Enabled' : 'Disabled'}</p>
                              <p><strong>Voice:</strong> {integration.voice_enabled ? 'Enabled (ElevenLabs Aria)' : 'Disabled'}</p>
                            </div>
                            <div>
                              <p><strong>Voice AI:</strong> ElevenLabs Aria</p>
                              <p><strong>Language:</strong> {integration.voice_settings?.language || 'en-US'}</p>
                            </div>
                         </div>
                         
                         <div>
                           <h4 className="font-medium mb-2">Configuration</h4>
                           <div className="bg-muted p-3 rounded text-sm">
                             <p><strong>Account SID:</strong> {integration.account_sid}</p>
                             <p><strong>Agent:</strong> {agents.find(a => a.id === integration.agent_id)?.name || 'Unknown Agent'}</p>
                             <p><strong>Client:</strong> {clients.find(c => c.id === integration.client_id)?.name || 'Unknown Client'}</p>
                           </div>
                         </div>

                         {integration.voice_settings?.welcome_message && (
                           <div>
                             <h4 className="font-medium mb-2">Welcome Message</h4>
                             <div className="bg-muted p-3 rounded text-sm">
                               <p>{integration.voice_settings.welcome_message}</p>
                             </div>
                           </div>
                         )}
                         
                         <div className="border-t pt-4">
                           <h4 className="font-medium mb-2">Webhook Configuration</h4>
                           <p className="text-xs text-muted-foreground mb-3">
                             Copy these URLs and paste them in your Twilio Console under your phone number settings:
                           </p>
                           
                           <div className="space-y-3">
                             <div>
                               <label className="text-xs font-medium text-muted-foreground">Voice Webhook URL:</label>
                               <div className="flex gap-2 mt-1">
                                 <input
                                   type="text"
                                   value={generateWebhookUrls().voice}
                                   readOnly
                                   className="flex-1 px-2 py-1 text-xs border rounded font-mono"
                                 />
                                 <Button
                                   size="sm"
                                   variant="outline"
                                   onClick={() => copyToClipboard(generateWebhookUrls().voice)}
                                   className="px-3"
                                 >
                                   <Copy className="h-3 w-3" />
                                 </Button>
                               </div>
                             </div>
                             
                             <div>
                               <label className="text-xs font-medium text-muted-foreground">SMS Webhook URL:</label>
                               <div className="flex gap-2 mt-1">
                                 <input
                                   type="text"
                                   value={generateWebhookUrls().sms}
                                   readOnly
                                   className="flex-1 px-2 py-1 text-xs border rounded font-mono"
                                 />
                                 <Button
                                   size="sm"
                                   variant="outline"
                                   onClick={() => copyToClipboard(generateWebhookUrls().sms)}
                                   className="px-3"
                                 >
                                   <Copy className="h-3 w-3" />
                                 </Button>
                               </div>
                             </div>
                           </div>
                           
                           <p className="text-xs text-muted-foreground mt-3">
                             💡 In Twilio Console: Phone Numbers → Manage → Active Numbers → Select your number → Configure webhooks
                           </p>
                         </div>
                       </div>
                     </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ChatWidgetManager;