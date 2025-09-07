import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Copy, ExternalLink, Settings, MessageCircle } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [lastCreatedWidget, setLastCreatedWidget] = useState<any>(null);
  const [formData, setFormData] = useState({
    client_id: '',
    agent_id: '',
    widget_name: '',
    primary_color: '#2563eb',
    welcome_message: 'Hello! How can I help you today?',
    position: 'bottom-right',
    size: 'medium'
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

      // TODO: Load existing widgets once types are regenerated
      // const { data: widgetsData } = await supabase
      //   .from('chat_widgets')
      //   .select('*')
      //   .order('created_at', { ascending: false });
      // if (widgetsData) setWidgets(widgetsData);
      
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
            <Button onClick={() => {
              setShowCreateForm(true);
              setLastCreatedWidget(null);
            }}>
              <MessageCircle className="h-4 w-4 mr-2" />
              Create Widget
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
      </main>
    </div>
  );
};

export default ChatWidgetManager;