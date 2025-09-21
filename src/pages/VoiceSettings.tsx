import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Bot, Mic, Settings, ArrowLeft } from "lucide-react";
import { BlandIntegrationForm } from "@/components/BlandIntegrationForm";
import { BlandIntegrationList } from "@/components/BlandIntegrationList";
import { BlandAdvancedSettings } from "@/components/BlandAdvancedSettings";
import { BlandPathwayManager } from "@/components/BlandPathwayManager";
import { BlandCampaignManager } from "@/components/BlandCampaignManager";
import { BlandAnalyticsDashboard } from "@/components/BlandAnalyticsDashboard";
import { BlandInboundNumberManager } from "@/components/BlandInboundNumberManager";
import { useNavigate } from "react-router-dom";

interface Client {
  id: string;
  name: string;
}

interface Agent {
  id: string;
  name: string;
  client_id: string;
}

const VoiceSettings = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');

      if (clientsError) throw clientsError;

      setClients(clientsData || []);

      // Load agents
      const { data: agentsData, error: agentsError } = await supabase
        .from('ai_agents')
        .select('id, name, client_id')
        .order('name');

      if (agentsError) throw agentsError;

      setAgents(agentsData || []);

      // Set default client if available
      if (clientsData && clientsData.length > 0) {
        setSelectedClientId(clientsData[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    setRefreshKey(prev => prev + 1);
    toast({
      title: "Success",
      description: "Voice integration updated successfully.",
    });
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const clientAgents = agents.filter(a => a.client_id === selectedClientId);

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
            <Button variant="outline" onClick={() => navigate('/dashboard')} className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center">
              <Settings className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-semibold text-foreground">Voice Integration Settings</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground">Voice Integrations</h2>
          <p className="text-muted-foreground mt-2">
            Manage Twilio and Bland AI voice integrations for your clients
          </p>
        </div>

        {clients.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No Clients Available</h3>
              <p className="text-muted-foreground mb-4">Create a client first to set up voice integrations.</p>
              <Button onClick={() => navigate('/clients/new')}>
                Create Client
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Client Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Select Client</label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full max-w-md px-3 py-2 border border-border rounded-md bg-background"
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedClient && (
              <Tabs defaultValue="bland-ai" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8">
                  <TabsTrigger value="bland-ai" className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    Bland AI
                  </TabsTrigger>
                  <TabsTrigger value="twilio" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Twilio
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="bland-ai" className="space-y-6">
                  <Tabs defaultValue="integrations" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-6">
                      <TabsTrigger value="integrations">Integrations</TabsTrigger>
                      <TabsTrigger value="inbound">Inbound Numbers</TabsTrigger>
                      <TabsTrigger value="pathways">Pathways</TabsTrigger>
                      <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
                      <TabsTrigger value="settings">Advanced</TabsTrigger>
                      <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    </TabsList>

                    <TabsContent value="integrations" className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                          <h3 className="text-lg font-semibold mb-4">Create Bland AI Integration</h3>
                          {clientAgents.length > 0 ? (
                            <BlandIntegrationForm
                              clientId={selectedClientId}
                              agents={clientAgents}
                              onSuccess={handleSuccess}
                            />
                          ) : (
                            <Card>
                              <CardContent className="text-center py-8">
                                <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                <h4 className="text-lg font-semibold mb-2">No AI Agents</h4>
                                <p className="text-muted-foreground mb-4">
                                  Create an AI agent for {selectedClient.name} first.
                                </p>
                                <Button onClick={() => navigate('/agents/new')}>
                                  Create AI Agent
                                </Button>
                              </CardContent>
                            </Card>
                          )}
                        </div>

                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Bot className="h-5 w-5" />
                              About Bland AI Integration
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-semibold mb-2">Advanced Features</h4>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                  <li>• Custom conversation pathways</li>
                                  <li>• Automated calling campaigns</li>
                                  <li>• Advanced call settings & controls</li>
                                  <li>• Real-time analytics & insights</li>
                                  <li>• A/B testing capabilities</li>
                                  <li>• Custom tools & integrations</li>
                                </ul>
                              </div>
                              <div>
                                <h4 className="font-semibold mb-2">Use Cases</h4>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                  <li>• Customer outreach & sales</li>
                                  <li>• Appointment booking & reminders</li>
                                  <li>• Lead qualification & nurturing</li>
                                  <li>• Survey collection & feedback</li>
                                  <li>• Support & follow-up calls</li>
                                </ul>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-4">Active Integrations</h3>
                        <BlandIntegrationList
                          key={refreshKey}
                          clientId={selectedClientId}
                          onRefresh={() => {
                            setRefreshKey(prev => prev + 1);
                            // Auto-select first integration for advanced features
                            if (!selectedIntegrationId) {
                              // This will be handled by the BlandIntegrationList component
                            }
                          }}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="inbound" className="space-y-6">
                      {clientAgents.length > 0 ? (
                        <BlandInboundNumberManager
                          clientId={selectedClientId}
                          agents={clientAgents}
                          integrationId={selectedIntegrationId}
                        />
                      ) : (
                        <Card>
                          <CardContent className="text-center py-8">
                            <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-lg font-semibold mb-2">No AI Agents</h3>
                            <p className="text-muted-foreground mb-4">
                              Create an AI agent for {selectedClient.name} first to purchase inbound numbers.
                            </p>
                            <Button onClick={() => navigate('/agents/new')}>
                              Create AI Agent
                            </Button>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    <TabsContent value="pathways">
                      {selectedIntegrationId ? (
                        <BlandPathwayManager
                          integrationId={selectedIntegrationId}
                          clientId={selectedClientId}
                        />
                      ) : (
                        <Card>
                          <CardContent className="text-center py-8">
                            <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-lg font-semibold mb-2">Select an Integration</h3>
                            <p className="text-muted-foreground">
                              Choose a Bland AI integration from the Integrations tab to manage conversation pathways
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    <TabsContent value="campaigns">
                      {selectedIntegrationId ? (
                        <BlandCampaignManager
                          integrationId={selectedIntegrationId}
                          clientId={selectedClientId}
                        />
                      ) : (
                        <Card>
                          <CardContent className="text-center py-8">
                            <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-lg font-semibold mb-2">Select an Integration</h3>
                            <p className="text-muted-foreground">
                              Choose a Bland AI integration from the Integrations tab to manage campaigns
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    <TabsContent value="settings">
                      {selectedIntegrationId ? (
                        <BlandAdvancedSettings
                          integrationId={selectedIntegrationId}
                          clientId={selectedClientId}
                        />
                      ) : (
                        <Card>
                          <CardContent className="text-center py-8">
                            <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-lg font-semibold mb-2">Select an Integration</h3>
                            <p className="text-muted-foreground">
                              Choose a Bland AI integration from the Integrations tab to configure advanced settings
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    <TabsContent value="analytics">
                      {selectedIntegrationId ? (
                        <BlandAnalyticsDashboard
                          integrationId={selectedIntegrationId}
                        />
                      ) : (
                        <Card>
                          <CardContent className="text-center py-8">
                            <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-lg font-semibold mb-2">Select an Integration</h3>
                            <p className="text-muted-foreground">
                              Choose a Bland AI integration from the Integrations tab to view analytics
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>
                  </Tabs>
                </TabsContent>

                <TabsContent value="twilio" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Phone className="h-5 w-5" />
                        Twilio Integration
                      </CardTitle>
                      <CardDescription>
                        Configure Twilio for inbound voice calls and SMS
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8">
                        <Phone className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-xl font-semibold mb-2">Twilio Configuration</h3>
                        <p className="text-muted-foreground mb-4">
                          Twilio integration setup will be available soon.
                        </p>
                        <Button variant="outline" disabled>
                          Coming Soon
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>About Twilio Integration</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-semibold mb-2">Features</h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Inbound call handling</li>
                            <li>• SMS messaging</li>
                            <li>• Call recording</li>
                            <li>• Real-time voice AI</li>
                            <li>• Global phone numbers</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Use Cases</h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Customer support hotline</li>
                            <li>• Order status inquiries</li>
                            <li>• Technical support</li>
                            <li>• General information</li>
                            <li>• Emergency assistance</li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default VoiceSettings;