import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Plus, Settings, Trash2, Edit } from "lucide-react";
import { BlandInboundNumberPurchase } from "./BlandInboundNumberPurchase";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface InboundNumber {
  id: string;
  phone_number: string;
  agent_id: string;
  bland_number_id: string;
  country_code: string;
  area_code?: string;
  monthly_cost: number;
  is_active: boolean;
  created_at: string;
  ai_agents?: { name: string };
}

interface Agent {
  id: string;
  name: string;
}

interface BlandInboundNumberManagerProps {
  clientId: string;
  agents: Agent[];
  integrationId?: string;
}

export const BlandInboundNumberManager = ({ clientId, agents, integrationId }: BlandInboundNumberManagerProps) => {
  const [inboundNumbers, setInboundNumbers] = useState<InboundNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [editingNumber, setEditingNumber] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadInboundNumbers();
  }, [clientId]);

  const loadInboundNumbers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('bland-integration', {
        body: { action: 'list-inbound-numbers', client_id: clientId }
      });

      if (error) throw error;

      if (data?.success) {
        setInboundNumbers(data.inbound_numbers || []);
      }
    } catch (error) {
      console.error('Error loading inbound numbers:', error);
      toast({
        title: "Error",
        description: "Failed to load inbound numbers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAgent = async (numberId: string, newAgentId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('bland-integration', {
        body: { 
          action: 'update-inbound-number',
          number_id: numberId,
          agent_id: newAgentId
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Success",
          description: "Agent updated successfully",
        });
        loadInboundNumbers();
        setEditingNumber(null);
      }
    } catch (error) {
      console.error('Error updating agent:', error);
      toast({
        title: "Error",
        description: "Failed to update agent",
        variant: "destructive",
      });
    }
  };

  const handleDeleteNumber = async (numberId: string, phoneNumber: string) => {
    if (!confirm(`Are you sure you want to delete ${phoneNumber}? This action cannot be undone.`)) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('bland-integration', {
        body: { 
          action: 'delete-inbound-number',
          number_id: numberId
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Success",
          description: "Inbound number deleted successfully",
        });
        loadInboundNumbers();
      }
    } catch (error) {
      console.error('Error deleting number:', error);
      toast({
        title: "Error",
        description: "Failed to delete inbound number",
        variant: "destructive",
      });
    }
  };

  const totalMonthlyCost = inboundNumbers.reduce((sum, num) => sum + (num.monthly_cost || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Inbound Phone Numbers</h3>
          <p className="text-sm text-muted-foreground">
            Manage dedicated phone numbers for customer support calls
          </p>
        </div>
        <Button onClick={() => setShowPurchaseForm(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Purchase Number
        </Button>
      </div>

      {inboundNumbers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Monthly Cost Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalMonthlyCost.toFixed(2)}/month</div>
            <p className="text-sm text-muted-foreground">Total for {inboundNumbers.length} numbers</p>
          </CardContent>
        </Card>
      )}

      {showPurchaseForm && (
        <BlandInboundNumberPurchase
          clientId={clientId}
          integrationId={integrationId}
          agents={agents}
          onSuccess={() => {
            setShowPurchaseForm(false);
            loadInboundNumbers();
          }}
          onCancel={() => setShowPurchaseForm(false)}
        />
      )}

      <div className="grid gap-4">
        {inboundNumbers.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Phone className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No Inbound Numbers</h3>
              <p className="text-muted-foreground mb-4">
                Purchase your first inbound phone number to start receiving customer support calls
              </p>
              <Button onClick={() => setShowPurchaseForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Purchase First Number
              </Button>
            </CardContent>
          </Card>
        ) : (
          inboundNumbers.map((number) => (
            <Card key={number.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-full">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-lg">{number.phone_number}</div>
                      <div className="text-sm text-muted-foreground">
                        {number.country_code} {number.area_code ? `• Area: ${number.area_code}` : ''}
                        • ${number.monthly_cost}/month
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Active
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div>
                      <span className="text-sm font-medium">Assigned Agent:</span>
                      {editingNumber === number.id ? (
                        <div className="flex items-center space-x-2 mt-1">
                          <Select
                            value={number.agent_id}
                            onValueChange={(value) => handleUpdateAgent(number.id, value)}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {agents.map((agent) => (
                                <SelectItem key={agent.id} value={agent.id}>
                                  {agent.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingNumber(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-sm text-muted-foreground">
                            {number.ai_agents?.name || 'No agent assigned'}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingNumber(number.id)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingNumber(number.id)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteNumber(number.id, number.phone_number)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  Purchased on {new Date(number.created_at).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};