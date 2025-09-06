import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Plus, Bot, MessageSquare, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      setUser(session.user);
      await loadData();
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        navigate('/auth');
      } else if (session) {
        setUser(session.user);
      }
    });

    getSession();
    return () => subscription.unsubscribe();
  }, [navigate]);

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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
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
              <span className="text-sm text-muted-foreground">{user?.email}</span>
              <Button variant="outline" onClick={handleSignOut}>
                Sign Out
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {agents.filter(a => a.status === 'active').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Integrations</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
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
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No clients yet. Create your first client to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {clients.slice(0, 3).map((client) => (
                    <div key={client.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div>
                        <h3 className="font-medium">{client.name}</h3>
                        <p className="text-sm text-muted-foreground">{client.domain}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/clients/${client.id}`)}>
                        Manage
                      </Button>
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
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No agents created yet. Create your first AI agent.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {agents.slice(0, 3).map((agent) => (
                    <div key={agent.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{agent.name}</h3>
                          <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
                            {agent.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{agent.description}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/agents/${agent.id}`)}>
                        Configure
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