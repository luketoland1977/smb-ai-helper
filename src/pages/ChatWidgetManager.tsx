import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Copy, ExternalLink, Settings, MessageCircle, Phone, MessageSquare } from 'lucide-react';
import VoiceInterface from '@/components/VoiceInterface';
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
    size: 'medium',
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
              <h1 className="text-3xl font-bold">Chat Widget Manager</h1>
              <p className="text-muted-foreground mt-1">Create and manage your AI chat widgets</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
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
              <MessageCircle className="h-4 w-4 mr-2" />
              Create Chat Widget
            </Button>
          </div>

          {lastCreatedWidget && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-800">Widget Created Successfully!</CardTitle>
                <CardDescription className="text-green-600">
                  Copy the embed code below and paste it into your website
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Widget Configuration</h4>
                    <div className="bg-green-100 p-3 rounded text-sm">
                      <p><strong>Widget Name:</strong> {lastCreatedWidget.widget_name}</p>
                      <p><strong>Primary Color:</strong> {lastCreatedWidget.config.primaryColor}</p>
                      <p><strong>Position:</strong> {lastCreatedWidget.config.position}</p>
                      <p><strong>Size:</strong> {lastCreatedWidget.config.size}</p>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">Embed Code</h4>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(lastCreatedWidget.embed_code)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Code
                      </Button>
                    </div>
                    <pre className="bg-green-100 p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap">
                      {lastCreatedWidget.embed_code}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6">
            <h3 className="text-lg font-semibold">Existing Chat Widgets</h3>
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
        </div>
      </main>
    </div>
  );
};

export default ChatWidgetManager;