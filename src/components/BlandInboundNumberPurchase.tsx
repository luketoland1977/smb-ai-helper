import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Phone, X, Search } from "lucide-react";

interface Agent {
  id: string;
  name: string;
}

interface AvailableNumber {
  phone_number: string;
  friendly_name: string;
  monthly_cost: number;
  capabilities: string[];
}

interface BlandInboundNumberPurchaseProps {
  clientId: string;
  integrationId?: string;
  agents: Agent[];
  onSuccess: () => void;
  onCancel: () => void;
}

export const BlandInboundNumberPurchase = ({ 
  clientId, 
  integrationId, 
  agents, 
  onSuccess, 
  onCancel 
}: BlandInboundNumberPurchaseProps) => {
  const [loading, setLoading] = useState(false);
  const [searchingNumbers, setSearchingNumbers] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [formData, setFormData] = useState({
    agent_id: agents[0]?.id || "",
    country_code: "US",
    area_code: "",
    selected_number: "",
  });
  const { toast } = useToast();

  const searchAvailableNumbers = async () => {
    setSearchingNumbers(true);
    try {
      const params = new URLSearchParams({
        action: 'get-available-numbers',
        country_code: formData.country_code,
      });
      
      if (formData.area_code) {
        params.append('area_code', formData.area_code);
      }

      const { data, error } = await supabase.functions.invoke(`bland-integration?${params}`);

      if (error) throw error;

      if (data?.success) {
        setAvailableNumbers(data.available_numbers || []);
        if (data.available_numbers?.length === 0) {
          toast({
            title: "No Numbers Available",
            description: "No phone numbers available for the selected criteria. Try a different area code.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Error searching numbers:', error);
      toast({
        title: "Error",
        description: "Failed to search available numbers",
        variant: "destructive",
      });
    } finally {
      setSearchingNumbers(false);
    }
  };

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.selected_number) {
      toast({
        title: "Error",
        description: "Please select a phone number to purchase",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('bland-integration', {
        body: {
          action: 'purchase-inbound-number',
          client_id: clientId,
          integration_id: integrationId,
          agent_id: formData.agent_id,
          country_code: formData.country_code,
          area_code: formData.area_code,
          selected_number: formData.selected_number,
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Number Purchased Successfully",
          description: `Your new inbound number ${data.inbound_number.phone_number} is now active for customer support.`,
        });
        onSuccess();
      } else {
        throw new Error(data?.error || "Failed to purchase number");
      }
    } catch (error) {
      console.error('Error purchasing number:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to purchase inbound number. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedNumberInfo = availableNumbers.find(n => n.phone_number === formData.selected_number);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Purchase Inbound Phone Number
            </CardTitle>
            <CardDescription>
              Get a dedicated phone number for customer support calls
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handlePurchase} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="agent_id">Assign to AI Agent</Label>
            <Select 
              value={formData.agent_id} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, agent_id: value }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an AI agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country_code">Country</Label>
              <Select 
                value={formData.country_code} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, country_code: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                  <SelectItem value="GB">United Kingdom</SelectItem>
                  <SelectItem value="AU">Australia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="area_code">Area Code (Optional)</Label>
              <Input
                id="area_code"
                type="text"
                placeholder="e.g., 212, 415"
                value={formData.area_code}
                onChange={(e) => setFormData(prev => ({ ...prev, area_code: e.target.value }))}
                maxLength={3}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Available Phone Numbers</Label>
              <Button
                type="button"
                variant="outline"
                onClick={searchAvailableNumbers}
                disabled={searchingNumbers}
                className="flex items-center gap-2"
              >
                {searchingNumbers ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search Numbers
              </Button>
            </div>

            {availableNumbers.length > 0 && (
              <div className="space-y-2">
                <Label>Select a Number</Label>
                <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-2">
                  {availableNumbers.map((number) => (
                    <div
                      key={number.phone_number}
                      className={`p-3 rounded border cursor-pointer transition-colors ${
                        formData.selected_number === number.phone_number
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setFormData(prev => ({ ...prev, selected_number: number.phone_number }))}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{number.phone_number}</div>
                          <div className="text-sm text-muted-foreground">{number.friendly_name}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">${number.monthly_cost || 1.00}/month</div>
                          <div className="text-xs text-muted-foreground">
                            {number.capabilities?.join(', ') || 'Voice'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {availableNumbers.length === 0 && !searchingNumbers && (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Click "Search Numbers" to find available phone numbers</p>
              </div>
            )}
          </div>

          {selectedNumberInfo && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">Purchase Summary</h4>
                    <p className="text-sm text-muted-foreground">
                      Number: {selectedNumberInfo.phone_number}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Agent: {agents.find(a => a.id === formData.agent_id)?.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">${selectedNumberInfo.monthly_cost || 1.00}</div>
                    <div className="text-sm text-muted-foreground">per month</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-2">
            <Button 
              type="submit" 
              disabled={loading || !formData.selected_number} 
              className="flex-1"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Phone className="mr-2 h-4 w-4" />
              Purchase Number
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};