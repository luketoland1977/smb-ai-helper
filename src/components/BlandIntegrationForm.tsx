import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Phone, Bot } from "lucide-react";

interface BlandIntegrationFormProps {
  clientId: string;
  agents: Array<{ id: string; name: string; }>;
  onSuccess: () => void;
}

export const BlandIntegrationForm = ({ clientId, agents, onSuccess }: BlandIntegrationFormProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    agent_id: "",
    phone_number: "",
    voice: "jennifer",
    language: "en-US",
    speed: 1.0,
  });
  const { toast } = useToast();

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

          <div className="space-y-2">
            <Label htmlFor="phone_number">Phone Number</Label>
            <Input
              id="phone_number"
              type="tel"
              placeholder="+1234567890"
              value={formData.phone_number}
              onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
              required
            />
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

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Phone className="mr-2 h-4 w-4" />
            Create Bland AI Integration
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};