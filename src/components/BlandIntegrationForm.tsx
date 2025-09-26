import { useState } from "react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Phone, Bot, ShoppingCart, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface BlandIntegrationFormProps {
  clientId: string;
  agents: Array<{ id: string; name: string; }>;
  onSuccess: () => void;
}

interface AvailableNumber {
  number: string;
  price: number;
  area_code: string;
  region: string;
}

export const BlandIntegrationForm = ({ clientId, agents, onSuccess }: BlandIntegrationFormProps) => {
  const [loading, setLoading] = useState(false);
  const [purchasingNumber, setPurchasingNumber] = useState(false);
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [formData, setFormData] = useState({
    agent_id: "",
    phone_number: "",
    voice: "jennifer",
    language: "en-US",
    speed: 1.0,
  });
  const { toast } = useToast();

  // Auto-select the first agent if available
  React.useEffect(() => {
    if (agents.length > 0 && !formData.agent_id) {
      setFormData(prev => ({ ...prev, agent_id: agents[0].id }));
    }
  }, [agents, formData.agent_id]);

  // Load available numbers on component mount
  React.useEffect(() => {
    loadAvailableNumbers();
  }, []);

  const loadAvailableNumbers = async () => {
    setLoadingNumbers(true);
    try {
      const { data, error } = await supabase.functions.invoke('bland-integration', {
        body: {
          action: 'search-numbers',
        }
      });

      if (error) throw error;

      if (data?.success && data?.numbers) {
        setAvailableNumbers(data.numbers);
        toast({
          title: "Numbers Refreshed",
          description: `Found ${data.numbers.length} available numbers`,
        });
      } else {
        setAvailableNumbers([]);
        toast({
          title: "No Numbers Available",
          description: "No phone numbers currently available",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading numbers:', error);
      toast({
        title: "Error",
        description: "Failed to load available numbers. Please try again.",
        variant: "destructive",
      });
      setAvailableNumbers([]);
    } finally {
      setLoadingNumbers(false);
    }
  };


  const purchaseNumber = async (number: string, price: number) => {
    setPurchasingNumber(true);
    try {
      const { data, error } = await supabase.functions.invoke('bland-integration', {
        body: {
          action: 'purchase-number',
          phone_number: number,
        }
      });

      if (error) throw error;

      if (data?.success) {
        setFormData(prev => ({ ...prev, phone_number: number }));
        setAvailableNumbers([]);
        toast({
          title: "Number Purchased",
          description: `Successfully purchased ${number} for $${price}`,
        });
      } else {
        throw new Error(data?.error || "Failed to purchase number");
      }
    } catch (error) {
      console.error('Error purchasing number:', error);
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to purchase phone number. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPurchasingNumber(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('bland-integration', {
        body: {
          action: 'create-agent',
          client_id: clientId,
          agent_id: formData.agent_id,
          phone_number: formData.phone_number,
          voice_settings: {
            voice: formData.voice,
            language: formData.language,
            speed: formData.speed,
          }
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Bland AI Integration Created",
          description: "Your Bland AI voice agent has been successfully configured.",
        });
        onSuccess();
      } else {
        throw new Error(data?.error || "Failed to create integration");
      }
    } catch (error) {
      console.error('Error creating Bland AI integration:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create Bland AI integration. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Create Bland AI Integration
        </CardTitle>
        <CardDescription>
          Configure a Bland AI voice agent for automated phone calls
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent_id">AI Agent</Label>
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

          {/* Phone Number Purchase Section */}
          <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <Label className="text-base font-semibold">Phone Number</Label>
            </div>
            
            {!formData.phone_number ? (
              <>
                {/* Available Numbers Display */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Available Numbers</Label>
                    <Button 
                      type="button" 
                      onClick={loadAvailableNumbers}
                      disabled={loadingNumbers}
                      variant="outline"
                      size="sm"
                    >
                      {loadingNumbers ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Refresh Numbers
                    </Button>
                  </div>
                  
                  {availableNumbers.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {availableNumbers.map((num, index) => (
                        <div 
                          key={index}
                          className="flex items-center justify-between p-3 border rounded-lg bg-background hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="font-mono font-medium">{num.number}</div>
                            <div className="text-sm text-muted-foreground">
                              {num.region} • Area Code {num.area_code}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">${num.price}/month</Badge>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => purchaseNumber(num.number, num.price)}
                              disabled={purchasingNumber}
                            >
                              {purchasingNumber ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <ShoppingCart className="h-3 w-3" />
                              )}
                              Purchase
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !loadingNumbers ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No available numbers found</p>
                      <p className="text-sm">Click "Refresh Numbers" to load new available numbers</p>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50 border-green-200">
                <div>
                  <div className="font-mono font-medium text-green-800">{formData.phone_number}</div>
                  <div className="text-sm text-green-600">Purchased number ready for integration</div>
                </div>
                <Badge className="bg-green-100 text-green-800">Selected</Badge>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="voice">Voice</Label>
              <Select 
                value={formData.voice} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, voice: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jennifer">Jennifer (Female)</SelectItem>
                  <SelectItem value="dan">Dan (Male)</SelectItem>
                  <SelectItem value="sarah">Sarah (Female)</SelectItem>
                  <SelectItem value="alex">Alex (Male)</SelectItem>
                  <SelectItem value="maya">Maya (Female)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select 
                value={formData.language} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, language: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en-US">English (US)</SelectItem>
                  <SelectItem value="en-GB">English (UK)</SelectItem>
                  <SelectItem value="es-ES">Spanish</SelectItem>
                  <SelectItem value="fr-FR">French</SelectItem>
                  <SelectItem value="de-DE">German</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="speed">Speech Speed: {formData.speed}</Label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={formData.speed}
              onChange={(e) => setFormData(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Slow (0.5x)</span>
              <span>Normal (1.0x)</span>
              <span>Fast (2.0x)</span>
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={loading || !formData.phone_number} 
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Phone className="mr-2 h-4 w-4" />
            Create Bland AI Integration
          </Button>
          
          {!formData.phone_number && (
            <p className="text-xs text-muted-foreground text-center">
              Please purchase a phone number before creating the integration
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
};