import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Copy, ExternalLink, Settings, MessageCircle, Phone, MessageSquare } from 'lucide-react';
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

interface TwilioIntegration {
  id: string;
  client_id: string;
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
  const [clients, setClients] = useState<Client[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [twilioIntegrations, setTwilioIntegrations] = useState<TwilioIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showTwilioForm, setShowTwilioForm] = useState(false);
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

  const [twilioFormData, setTwilioFormData] = useState({
    client_id: '',
    account_sid: '',
    auth_token: '',
    phone_number: '',
    sms_enabled: true,
    voice_enabled: true,
    voice: 'alice',
    language: 'en-US',
  });

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

      // Load Twilio integrations
      const { data: twilioData } = await supabase
        .from('twilio_integrations')
        .select('*')
        .order('created_at', { ascending: false });
      if (twilioData) setTwilioIntegrations(twilioData);
      
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
      // TODO: Save to database once types are regenerated
      // const { data, error } = await supabase
      //   .from('chat_widgets')
      //   .insert([{
      //     client_id: formData.client_id,
      //     agent_id: formData.agent_id,
      //     widget_name: formData.widget_name,
      //     widget_config: config,
      //     embed_code: embedCode,
      //     is_active: true
      //   }])
      //   .select()
      //   .single();

      // Store the created widget for display
      setLastCreatedWidget({
        client_id: formData.client_id,
        agent_id: formData.agent_id,
        widget_name: formData.widget_name,
        config: config,
        embed_code: embedCode
      });

      toast({
        title: "Widget Created",
        description: "Your chat widget has been configured. Copy the embed code below.",
      });

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
      
      setShowCreateForm(false);
      
    } catch (error) {
      console.error('Error creating widget:', error);
      toast({
        title: "Error",
        description: "Failed to create widget",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Embed code copied to clipboard",
    });
  };

  const createTwilioIntegration = async () => {
    try {
      const { data, error } = await supabase
        .from('twilio_integrations')
        .insert({
          client_id: twilioFormData.client_id,
          account_sid: twilioFormData.account_sid,
          phone_number: twilioFormData.phone_number,
          sms_enabled: twilioFormData.sms_enabled,
          voice_enabled: twilioFormData.voice_enabled,
          voice_settings: {
            voice: twilioFormData.voice,
            language: twilioFormData.language
          }
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Twilio Integration Created",
        description: `Phone integration configured for ${twilioFormData.phone_number}`,
      });

      // Refresh data
      loadData();
      setShowTwilioForm(false);
      setTwilioFormData({
        client_id: '',
        account_sid: '',
        auth_token: '',
        phone_number: '',
        sms_enabled: true,
        voice_enabled: true,
        voice: 'alice',
        language: 'en-US',
      });

    } catch (error) {
      console.error('Error creating Twilio integration:', error);
      toast({
        title: "Error",
        description: "Failed to create Twilio integration",
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
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-foreground">Chat Widget Manager</h1>
            <div className="flex space-x-3">
              <Button onClick={() => {
                setShowCreateForm(true);
                setLastCreatedWidget(null);
              }}>
                <MessageCircle className="h-4 w-4 mr-2" />
                Create Widget
              </Button>
              <Button variant="outline" onClick={() => setShowTwilioForm(true)}>
                <Phone className="h-4 w-4 mr-2" />
                Add Phone Integration
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="widgets" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="widgets">
              <MessageCircle className="h-4 w-4 mr-2" />
              Chat Widgets
            </TabsTrigger>
            <TabsTrigger value="phone">
              <Phone className="h-4 w-4 mr-2" />
              Phone Integration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="widgets" className="space-y-6">
        {showCreateForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Create Chat Widget</CardTitle>
              <CardDescription>
                Configure and generate an embeddable chat widget for your website
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="client">Client *</Label>
                  <select
                    id="client"
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    className="w-full p-2 border border-border rounded-md bg-background"
                    required
                  >
                    <option value="">Select a client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agent">AI Agent *</Label>
                  <select
                    id="agent"
                    value={formData.agent_id}
                    onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
                    className="w-full p-2 border border-border rounded-md bg-background"
                    required
                  >
                    <option value="">Select an agent</option>
                    {agents
                      .filter(agent => !formData.client_id || agent.client_id === formData.client_id)
                      .map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="widget_name">Widget Name *</Label>
                  <Input
                    id="widget_name"
                    value={formData.widget_name}
                    onChange={(e) => setFormData({ ...formData, widget_name: e.target.value })}
                    placeholder="e.g., Support Chat"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primary_color">Primary Color</Label>
                  <Input
                    id="primary_color"
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="position">Position</Label>
                  <select
                    id="position"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full p-2 border border-border rounded-md bg-background"
                  >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="top-left">Top Left</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="size">Size</Label>
                  <select
                    id="size"
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    className="w-full p-2 border border-border rounded-md bg-background"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="welcome_message">Welcome Message</Label>
                <Textarea
                  id="welcome_message"
                  value={formData.welcome_message}
                  onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
                  placeholder="Hello! How can I help you today?"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-4">
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateWidget}>
                  Create Widget
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Widget Preview and Embed Code - Show during creation or after creation */}
        {((formData.client_id && formData.agent_id && formData.widget_name) || lastCreatedWidget) && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>
                {lastCreatedWidget ? `Widget "${lastCreatedWidget.widget_name}" - Embed Code` : 'Widget Preview & Embed Code'}
              </CardTitle>
              <CardDescription>
                Copy this code and paste it into your website's HTML
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Embed Code</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(lastCreatedWidget 
                        ? lastCreatedWidget.embed_code 
                        : generateEmbedCode(formData.client_id, formData.agent_id, {
                          primaryColor: formData.primary_color,
                          welcomeMessage: formData.welcome_message,
                          position: formData.position,
                          size: formData.size
                        })
                      )}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">
                    {lastCreatedWidget 
                      ? lastCreatedWidget.embed_code 
                      : generateEmbedCode(formData.client_id, formData.agent_id, {
                        primaryColor: formData.primary_color,
                        welcomeMessage: formData.welcome_message,
                        position: formData.position,
                        size: formData.size
                      })
                    }
                  </pre>
                </div>

                {/* Live Widget Preview */}
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Live Preview</h4>
                  <div className="relative h-[700px] bg-white rounded border overflow-hidden">
                    <iframe
                      srcDoc={`
                        <!DOCTYPE html>
                        <html>
                        <head>
                          <meta charset="UTF-8">
                          <meta name="viewport" content="width=device-width, initial-scale=1.0">
                          <title>Widget Preview</title>
                          <style>
                            body { 
                              margin: 0; 
                              padding: 20px; 
                              background: #f0f0f0; 
                              font-family: Arial, sans-serif;
                            }
                          </style>
                        </head>
                        <body>
                          <h3>Your website content here...</h3>
                          <p>This is a preview of how the chat widget will appear on your website. Click the chat button to test it!</p>
                          
                          ${lastCreatedWidget 
                            ? lastCreatedWidget.embed_code 
                            : generateEmbedCode(formData.client_id, formData.agent_id, {
                              primaryColor: formData.primary_color,
                              welcomeMessage: formData.welcome_message,
                              position: formData.position,
                              size: formData.size
                            })
                          }
                        </body>
                        </html>
                      `}
                      className="w-full h-full border-0"
                      title="Widget Preview"
                      sandbox="allow-scripts allow-same-origin allow-forms"
                    />
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Integration Instructions</h4>
                  <ol className="text-sm space-y-1 list-decimal list-inside">
                    <li>Copy the embed code above</li>
                    <li>Paste it into your website's HTML, preferably before the closing &lt;/body&gt; tag</li>
                    <li>The chat widget will automatically appear on your website</li>
                    <li>Visitors can start chatting immediately with your AI agent</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions for next steps */}
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
            <CardDescription>
              Complete these steps to make your chat widget fully functional
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div>
                  <h4 className="font-medium">Upload Knowledge Base Documents</h4>
                  <p className="text-sm text-muted-foreground">
                    Add documents to train your AI agent with specific knowledge about your business
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <div>
                  <h4 className="font-medium">Test Your Widget</h4>
                  <p className="text-sm text-muted-foreground">
                    Embed the widget on a test page and verify it's working correctly
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                  3
                </div>
                <div>
                  <h4 className="font-medium">Monitor Conversations</h4>
                  <p className="text-sm text-muted-foreground">
                    Track customer interactions and agent performance in the dashboard
                  </p>
                </div>
              </div>
             </div>
           </CardContent>
         </Card>

          </TabsContent>

          <TabsContent value="phone" className="space-y-6">
            {showTwilioForm && (
              <Card>
                <CardHeader>
                  <CardTitle>Configure Phone Integration</CardTitle>
                  <CardDescription>
                    Set up Twilio integration for SMS and voice calls
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="twilio-client">Client *</Label>
                      <select
                        id="twilio-client"
                        value={twilioFormData.client_id}
                        onChange={(e) => setTwilioFormData({ ...twilioFormData, client_id: e.target.value })}
                        className="w-full p-2 border border-border rounded-md bg-background"
                        required
                      >
                        <option value="">Select a client</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone-number">Phone Number *</Label>
                      <Input
                        id="phone-number"
                        value={twilioFormData.phone_number}
                        onChange={(e) => setTwilioFormData({ ...twilioFormData, phone_number: e.target.value })}
                        placeholder="+1234567890"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="account-sid">Twilio Account SID *</Label>
                      <Input
                        id="account-sid"
                        value={twilioFormData.account_sid}
                        onChange={(e) => setTwilioFormData({ ...twilioFormData, account_sid: e.target.value })}
                        placeholder="AC..."
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="auth-token">Auth Token *</Label>
                      <Input
                        id="auth-token"
                        type="password"
                        value={twilioFormData.auth_token}
                        onChange={(e) => setTwilioFormData({ ...twilioFormData, auth_token: e.target.value })}
                        placeholder="Your Twilio Auth Token"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={twilioFormData.sms_enabled}
                        onChange={(e) => setTwilioFormData({ ...twilioFormData, sms_enabled: e.target.checked })}
                      />
                      <span>Enable SMS</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={twilioFormData.voice_enabled}
                        onChange={(e) => setTwilioFormData({ ...twilioFormData, voice_enabled: e.target.checked })}
                      />
                      <span>Enable Voice Calls</span>
                    </label>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <Button variant="outline" onClick={() => setShowTwilioForm(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createTwilioIntegration}>
                      Create Integration
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6">
              <h3 className="text-lg font-semibold">Existing Phone Integrations</h3>
              {twilioIntegrations.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">
                      No phone integrations configured yet.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                twilioIntegrations.map((integration) => (
                  <Card key={integration.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{integration.phone_number}</span>
                        <div className="flex items-center space-x-2">
                          {integration.sms_enabled && (
                            <Badge variant="secondary">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              SMS
                            </Badge>
                          )}
                          {integration.voice_enabled && (
                            <Badge variant="secondary">
                              <Phone className="h-3 w-3 mr-1" />
                              Voice
                            </Badge>
                          )}
                          <Badge variant={integration.is_active ? "default" : "destructive"}>
                            {integration.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p><strong>Client:</strong> {clients.find(c => c.id === integration.client_id)?.name}</p>
                        <p><strong>Account SID:</strong> {integration.account_sid}</p>
                        <p><strong>Webhook URLs:</strong></p>
                        <div className="bg-muted p-3 rounded text-sm space-y-1">
                          <p><strong>SMS:</strong> https://ycvvuepfsebqpwmamqgg.functions.supabase.co/functions/v1/twilio-sms-webhook</p>
                          <p><strong>Voice:</strong> https://ycvvuepfsebqpwmamqgg.functions.supabase.co/functions/v1/twilio-voice-webhook</p>
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