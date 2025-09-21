import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Bot, PhoneCall, Trash2, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface BlandIntegration {
  id: string;
  client_id: string;
  agent_id: string;
  bland_agent_id: string;
  phone_number: string;
  voice_settings: any;
  is_active: boolean;
  total_calls: number;
  last_call_at: string;
  created_at: string;
  ai_agents: { name: string };
}

interface BlandIntegrationListProps {
  clientId: string;
  onRefresh: () => void;
}

export const BlandIntegrationList = ({ clientId, onRefresh }: BlandIntegrationListProps) => {
  const [integrations, setIntegrations] = useState<BlandIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [callLoading, setCallLoading] = useState<string | null>(null);
  const [callData, setCallData] = useState({ to_phone: '', task: '' });
  const { toast } = useToast();

  useEffect(() => {
    fetchIntegrations();
  }, [clientId]);

  const fetchIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from('bland_integrations')
        .select(`
          *,
          ai_agents!inner(name)
        `)
        .eq('client_id', clientId);

      if (error) throw error;
      setIntegrations((data as any) || []);
    } catch (error) {
      console.error('Error fetching Bland AI integrations:', error);
      toast({
        title: "Error",
        description: "Failed to load Bland AI integrations.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const makeCall = async (integrationId: string) => {
    if (!callData.to_phone) {
      toast({
        title: "Error",
        description: "Please enter a phone number",
        variant: "destructive",
      });
      return;
    }

    setCallLoading(integrationId);
    try {
      const { data, error } = await supabase.functions.invoke('bland-integration', {
        body: {
          action: 'make-call',
          integration_id: integrationId,
          to_phone: callData.to_phone,
          task: callData.task || 'Have a friendly conversation with the person who answers.',
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Call Initiated",
          description: `Call to ${callData.to_phone} has been started via Bland AI.`,
        });
        setCallData({ to_phone: '', task: '' });
        fetchIntegrations(); // Refresh to update call count
      } else {
        throw new Error(data?.error || "Failed to make call");
      }
    } catch (error) {
      console.error('Error making call:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to initiate call. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCallLoading(null);
    }
  };

  const deleteIntegration = async (integrationId: string) => {
    try {
      const { error } = await supabase
        .from('bland_integrations')
        .delete()
        .eq('id', integrationId);

      if (error) throw error;

      toast({
        title: "Integration Deleted",
        description: "Bland AI integration has been removed.",
      });
      fetchIntegrations();
      onRefresh();
    } catch (error) {
      console.error('Error deleting integration:', error);
      toast({
        title: "Error",
        description: "Failed to delete integration. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading Bland AI integrations...</div>;
  }

  if (integrations.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Bland AI Integrations</h3>
          <p className="text-muted-foreground">Create your first Bland AI voice agent integration to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {integrations.map((integration) => (
        <Card key={integration.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <CardTitle>{integration.ai_agents.name}</CardTitle>
                <Badge variant={integration.is_active ? "default" : "secondary"}>
                  {integration.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <PhoneCall className="h-4 w-4 mr-2" />
                      Make Call
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Make Outbound Call</DialogTitle>
                      <DialogDescription>
                        Initiate a call using {integration.ai_agents.name} via Bland AI
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="to_phone">Phone Number</Label>
                        <Input
                          id="to_phone"
                          type="tel"
                          placeholder="+1234567890"
                          value={callData.to_phone}
                          onChange={(e) => setCallData(prev => ({ ...prev, to_phone: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task">Call Task (Optional)</Label>
                        <Textarea
                          id="task"
                          placeholder="Describe what the AI should accomplish on this call..."
                          value={callData.task}
                          onChange={(e) => setCallData(prev => ({ ...prev, task: e.target.value }))}
                        />
                      </div>
                      <Button 
                        onClick={() => makeCall(integration.id)} 
                        disabled={!!callLoading}
                        className="w-full"
                      >
                        {callLoading === integration.id ? "Initiating..." : "Start Call"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => deleteIntegration(integration.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardDescription>
              Phone: {integration.phone_number} • Voice: {integration.voice_settings?.voice || 'jennifer'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium">Total Calls</div>
                <div className="text-muted-foreground">{integration.total_calls || 0}</div>
              </div>
              <div>
                <div className="font-medium">Language</div>
                <div className="text-muted-foreground">{integration.voice_settings?.language || 'en-US'}</div>
              </div>
              <div>
                <div className="font-medium">Speed</div>
                <div className="text-muted-foreground">{integration.voice_settings?.speed || 1.0}x</div>
              </div>
              <div>
                <div className="font-medium">Last Call</div>
                <div className="text-muted-foreground">
                  {integration.last_call_at 
                    ? new Date(integration.last_call_at).toLocaleDateString()
                    : 'Never'
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};