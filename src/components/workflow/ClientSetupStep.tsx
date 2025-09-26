import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, CheckCircle, Users } from 'lucide-react';

interface ClientSetupStepProps {
  workflowState: any;
  onComplete: (data: { clientId: string }) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const ClientSetupStep: React.FC<ClientSetupStepProps> = ({ 
  workflowState, 
  onComplete, 
  onNext 
}) => {
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    subdomain: ''
  });
  const [loading, setLoading] = useState(false);
  const [existingClients, setExistingClients] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadExistingClients();
  }, []);

  const loadExistingClients = async () => {
    try {
      const { data: clients } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (clients) {
        setExistingClients(clients);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setLoading(true);
    try {
      const { data: client, error } = await supabase
        .from('clients')
        .insert({
          name: formData.name.trim(),
          domain: formData.domain.trim() || null,
          subdomain: formData.subdomain.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success!",
        description: `Client "${client.name}" has been created successfully.`,
      });

      onComplete({ clientId: client.id });
      
      // Auto-advance to next step after brief delay
      setTimeout(() => {
        onNext();
      }, 1500);

    } catch (error: any) {
      console.error('Error creating client:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create client",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectExistingClient = (client: any) => {
    onComplete({ clientId: client.id });
    toast({
      title: "Client Selected!",
      description: `Using existing client "${client.name}".`,
    });
    setTimeout(() => {
      onNext();
    }, 1000);
  };

  // If step is already completed, show completion state
  if (workflowState.completed[0]) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Client Setup Complete!</h3>
        <p className="text-muted-foreground mb-4">
          Your client has been successfully configured.
        </p>
        <Button onClick={onNext}>
          Continue to Agent Setup →
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Existing Clients */}
      {existingClients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Use Existing Client
            </CardTitle>
            <CardDescription>
              Select from your existing clients to continue the setup process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {existingClients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <h4 className="font-medium">{client.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {client.domain || 'No domain set'}
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => selectExistingClient(client)}
                  >
                    Select
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create New Client */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Plus className="h-5 w-5 mr-2" />
            Create New Client
          </CardTitle>
          <CardDescription>
            Set up a new client organization for your AI services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Client Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter client name"
                required
              />
            </div>

            <div>
              <Label htmlFor="domain">Domain (Optional)</Label>
              <Input
                id="domain"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                placeholder="example.com"
              />
            </div>

            <div>
              <Label htmlFor="subdomain">Subdomain (Optional)</Label>
              <Input
                id="subdomain"
                value={formData.subdomain}
                onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
                placeholder="support"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || !formData.name.trim()}
            >
              {loading ? "Creating..." : "Create Client & Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <h4 className="font-medium mb-2">What happens next?</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• A default AI agent will be automatically created</li>
            <li>• Client-user relationships will be established</li>
            <li>• You'll be able to configure agent settings in the next step</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientSetupStep;
