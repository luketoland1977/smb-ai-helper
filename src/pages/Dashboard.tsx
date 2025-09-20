import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Plus, Bot, MessageSquare, Settings, Users, Phone, Mic, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

interface Client {
  id: string;
  name: string;
  domain: string;
  subdomain: string;
  created_at: string;
  agent_count?: number;
  widget_count?: number;
  has_twilio?: boolean;
  default_agent?: {
    id: string;
    name: string;
    status: string;
    openai_api_key?: string;
  };
}

interface Agent {
  id: string;
  name: string;
  description: string;
  status: string;
  created_at: string;
  is_default: boolean;
  template_type?: string;
  client_name?: string;
}

const Dashboard = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load clients with enhanced data including widget and integration counts
      const { data: clientsData } = await supabase
        .from('clients')
        .select(`
          *,
          ai_agents!inner(id, name, status, is_default, openai_api_key),
          chat_widgets(id),
          voice_widgets(id),
          twilio_integrations(id, is_active)
        `)
        .order('created_at', { ascending: false });

      if (clientsData) {
        // Transform client data to include counts and default agent info
        const enrichedClients = clientsData.map((client: any) => ({
          ...client,
          agent_count: client.ai_agents?.length || 0,
          widget_count: (client.chat_widgets?.length || 0) + (client.voice_widgets?.length || 0),
          has_twilio: client.twilio_integrations?.some((t: any) => t.is_active) || false,
          default_agent: client.ai_agents?.find((a: any) => a.is_default) || null
        }));
        
        setClients(enrichedClients);
        
        // Load all agents with client information
        const { data: agentsData } = await supabase
          .from('ai_agents')
          .select(`
            *,
            clients!inner(name)
          `)
          .order('created_at', { ascending: false });
          
        if (agentsData) {
          const enrichedAgents = agentsData.map((agent: any) => ({
            ...agent,
            client_name: agent.clients?.name || 'Unknown Client'
          }));
          setAgents(enrichedAgents);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
            <div className="flex items-center">
              <Bot className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-semibold text-foreground">AI Service Pro</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={() => navigate('/widgets')}>
                Chat Widgets
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
          <p className="text-muted-foreground mt-2">
            Manage your AI customer service agents and integrations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients.length}</div>
              <p className="text-xs text-muted-foreground">
                Complete environments
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {agents.filter(a => a.status === 'active').length}
              </div>
              <p className="text-xs text-muted-foreground">
                AI assistants ready
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Widgets</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {clients.reduce((sum, client) => sum + (client.widget_count || 0), 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Chat & voice widgets
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Phone Integrations</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {clients.filter(client => client.has_twilio).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Twilio connected
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Clients</CardTitle>
                  <CardDescription>Manage your client organizations</CardDescription>
                </div>
                <Button onClick={() => navigate('/clients/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Client
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {clients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="mb-2">No clients yet. Create your first client to get started.</p>
                  <p className="text-xs">Each client gets a complete AI environment automatically.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {clients.slice(0, 3).map((client) => (
                    <div key={client.id} className="p-4 border border-border rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-medium">{client.name}</h3>
                          <p className="text-sm text-muted-foreground">{client.domain}</p>
                        </div>
                        <div className="flex items-center space-x-1">
                          {client.default_agent?.openai_api_key ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-yellow-500" />
                          )}
                          {client.has_twilio && <Phone className="h-4 w-4 text-blue-500" />}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                        <span>Agent: {client.default_agent?.name || 'Not configured'}</span>
                        <span>{client.widget_count || 0} widgets</span>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/clients/${client.id}/knowledge-base`)}>
                          Knowledge Base
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/clients/${client.id}`)}>
                          Configure
                        </Button>
                      </div>
                    </div>
                  ))}
                  {clients.length > 3 && (
                    <Button variant="ghost" className="w-full" onClick={() => navigate('/clients')}>
                      View All Clients ({clients.length})
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>AI Agents</CardTitle>
                  <CardDescription>Your intelligent customer service agents</CardDescription>
                </div>
                <Button onClick={() => navigate('/agents/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Agent
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {agents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="mb-2">No agents created yet.</p>
                  <p className="text-xs">Agents are created automatically with each client.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {agents.slice(0, 3).map((agent) => (
                    <div key={agent.id} className="p-4 border border-border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{agent.name}</h3>
                            {agent.is_default && (
                              <Badge variant="outline" className="text-xs">Default</Badge>
                            )}
                            <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
                              {agent.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{agent.client_name}</p>
                        </div>
                      </div>
                      
                      <div className="text-xs text-muted-foreground mb-3">
                        Template: {agent.template_type || 'general'}
                      </div>
                      
                      <Button variant="outline" size="sm" onClick={() => navigate(`/agents/${agent.id}`)}>
                        Configure Agent
                      </Button>
                    </div>
                  ))}
                  {agents.length > 3 && (
                    <Button variant="ghost" className="w-full" onClick={() => navigate('/agents')}>
                      View All Agents ({agents.length})
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;