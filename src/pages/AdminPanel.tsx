import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { 
  Bot, 
  MessageSquare, 
  Settings, 
  Users, 
  Plus, 
  Shield, 
  Database, 
  BarChart3,
  Headphones,
  Globe,
  FileText,
  UserCheck,
  Zap
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import WorkflowGuide from '@/components/WorkflowGuide';

interface Client {
  id: string;
  name: string;
  domain: string;
  subdomain: string;
  created_at: string;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  status: string;
  created_at: string;
}

const AdminPanel = () => {
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
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (clientsData) {
        setClients(clientsData);
        
        if (clientsData.length > 0) {
          const { data: agentsData } = await supabase
            .from('ai_agents')
            .select('*')
            .in('client_id', clientsData.map(c => c.id))
            .order('created_at', { ascending: false });
          
          if (agentsData) setAgents(agentsData);
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
              <h1 className="text-xl font-semibold text-foreground">AI Service Pro - Admin Panel</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Workflow Guide */}
        <div className="mb-12">
          <WorkflowGuide />
        </div>

        {/* Overview Stats */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground">Admin Panel</h2>
          <p className="text-muted-foreground mt-2">
            Centralized management for all admin, sales, and support operations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients.length}</div>
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
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chat Widgets</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Online</div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Section */}
        {hasRole('admin') && (
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
              <Shield className="h-5 w-5 mr-2 text-primary" />
              Admin Controls
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/role-requests')}>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <UserCheck className="h-5 w-5 mr-2" />
                    Role Requests
                  </CardTitle>
                  <CardDescription>Manage user role requests and permissions</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full">
                    Manage Requests
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <Database className="h-5 w-5 mr-2" />
                    System Settings
                  </CardTitle>
                  <CardDescription>Configure system-wide settings and preferences</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <BarChart3 className="h-5 w-5 mr-2" />
                    Analytics
                  </CardTitle>
                  <CardDescription>View system usage and performance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" disabled>
                    View Analytics
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Sales Section */}
        {(hasRole('admin') || hasRole('salesperson')) && (
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
              <Users className="h-5 w-5 mr-2 text-primary" />
              Sales & Client Management
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/clients/new')}>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <Plus className="h-5 w-5 mr-2" />
                    Add New Client
                  </CardTitle>
                  <CardDescription>Create a new client organization</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Client
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/agents/new')}>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <Bot className="h-5 w-5 mr-2" />
                    Create AI Agent
                  </CardTitle>
                  <CardDescription>Set up a new AI customer service agent</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">
                    <Bot className="h-4 w-4 mr-2" />
                    Create Agent
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/widgets')}>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <Globe className="h-5 w-5 mr-2" />
                    Chat Widgets
                  </CardTitle>
                  <CardDescription>Manage chat widgets and embed codes</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full">
                    Manage Widgets
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Support Section */}
        {(hasRole('admin') || hasRole('salesperson') || hasRole('support')) && (
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
              <Headphones className="h-5 w-5 mr-2 text-primary" />
              Support & Knowledge Management
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <FileText className="h-5 w-5 mr-2" />
                    Knowledge Base
                  </CardTitle>
                  <CardDescription>Manage knowledge bases for all clients</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {clients.slice(0, 3).map((client) => (
                      <Button
                        key={client.id}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => navigate(`/clients/${client.id}/knowledge-base`)}
                      >
                        {client.name}
                      </Button>
                    ))}
                    {clients.length === 0 && (
                      <p className="text-sm text-muted-foreground">No clients available</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <MessageSquare className="h-5 w-5 mr-2" />
                    Chat Monitoring
                  </CardTitle>
                  <CardDescription>Monitor ongoing customer conversations</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Quick Actions - Recent Clients & Agents */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Recent Clients</CardTitle>
              <CardDescription>Quickly access your client organizations</CardDescription>
            </CardHeader>
            <CardContent>
              {clients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No clients yet. Create your first client to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {clients.slice(0, 4).map((client) => (
                    <div key={client.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                      <div>
                        <h4 className="font-medium">{client.name}</h4>
                        <p className="text-sm text-muted-foreground">{client.domain}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/clients/${client.id}`)}>
                        Manage
                      </Button>
                    </div>
                  ))}
                  {clients.length > 4 && (
                    <Button variant="ghost" className="w-full" onClick={() => navigate('/clients')}>
                      View All ({clients.length})
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Agents Status</CardTitle>
              <CardDescription>Monitor your AI agents performance</CardDescription>
            </CardHeader>
            <CardContent>
              {agents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No agents created yet. Create your first AI agent.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {agents.slice(0, 4).map((agent) => (
                    <div key={agent.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Bot className="h-5 w-5 text-primary" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{agent.name}</h4>
                            <Badge variant={agent.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                              {agent.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{agent.description}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/agents/${agent.id}`)}>
                          Configure
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/agents/${agent.id}/voice-settings`)}>
                          <Headphones className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {agents.length > 4 && (
                    <Button variant="ghost" className="w-full" onClick={() => navigate('/agents')}>
                      View All ({agents.length})
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

export default AdminPanel;