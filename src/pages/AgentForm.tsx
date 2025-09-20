import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft } from 'lucide-react';

interface Client {
  id: string;
  name: string;
}

const AgentForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    client_id: '',
    system_prompt: '',
    status: 'active' as 'active' | 'inactive' | 'training',
    openai_api_key: ''
  });

  const isEditing = Boolean(id);

  useEffect(() => {
    loadClients();
    if (isEditing) {
      loadAgent();
    }
  }, [id, isEditing]);

  const loadClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name')
      .order('name');

    if (error) {
      console.error('Error loading clients:', error);
      return;
    }

    setClients(data || []);
  };

  const loadAgent = async () => {
    if (!id) return;
    
    const { data, error } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load agent data",
        variant: "destructive",
      });
      navigate('/dashboard');
      return;
    }

    if (data) {
      setFormData({
        name: data.name,
        description: data.description || '',
        client_id: data.client_id || '', // Handle null client_id properly
        system_prompt: data.system_prompt || '',
        status: data.status,
        openai_api_key: data.openai_api_key || ''
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.client_id) {
      toast({
        title: "Error",
        description: "Please select a client",
        variant: "destructive",
      });
      return;
    }

    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Please enter an agent name",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Prepare data, ensuring no empty strings for UUID fields
      const submitData = {
        ...formData,
        client_id: formData.client_id || null,
        description: formData.description || null,
        system_prompt: formData.system_prompt || null,
        openai_api_key: formData.openai_api_key || null
      };

      if (isEditing) {
        const { error } = await supabase
          .from('ai_agents')
          .update(submitData)
          .eq('id', id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Agent updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('ai_agents')
          .insert([submitData]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Agent created successfully",
        });
      }

      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error saving agent:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save agent",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const defaultSystemPrompt = `You are a helpful AI customer service agent. Your role is to:

1. Assist customers with their inquiries in a friendly and professional manner
2. Provide accurate information about products and services
3. Help resolve issues and complaints effectively
4. Escalate complex problems to human agents when necessary
5. Maintain a positive and helpful tone throughout interactions

Guidelines:
- Always be polite and respectful
- Listen carefully to customer concerns
- Provide clear and concise responses
- Ask clarifying questions when needed
- Offer solutions and alternatives when possible`;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button
              variant="ghost"
              onClick={() => navigate('/dashboard')}
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-xl font-semibold text-foreground">
              {isEditing ? 'Edit AI Agent' : 'Create New AI Agent'}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{isEditing ? 'Edit AI Agent' : 'Create New AI Agent'}</CardTitle>
            <CardDescription>
              {isEditing 
                ? 'Update your AI agent configuration'
                : 'Configure a new AI customer service agent'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="client_id">Client *</Label>
                <Select
                  value={formData.client_id}
                  onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Agent Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Customer Support Agent"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the agent's purpose"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => 
                    setFormData({ ...formData, status: value as 'active' | 'inactive' | 'training' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="openai_api_key">OpenAI API Key</Label>
                <Input
                  id="openai_api_key"
                  type="password"
                  value={formData.openai_api_key}
                  onChange={(e) => setFormData({ ...formData, openai_api_key: e.target.value })}
                  placeholder="sk-..."
                />
                <p className="text-sm text-muted-foreground">
                  Optional: Use your own OpenAI API key for this agent. If not provided, the system default will be used.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="system_prompt">System Prompt</Label>
                <Textarea
                  id="system_prompt"
                  value={formData.system_prompt}
                  onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                  placeholder={defaultSystemPrompt}
                  rows={12}
                  className="resize-none"
                />
                <p className="text-sm text-muted-foreground">
                  Define how the AI agent should behave and respond to customers
                </p>
                {!formData.system_prompt && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({ ...formData, system_prompt: defaultSystemPrompt })}
                  >
                    Use Default Prompt
                  </Button>
                )}
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading 
                    ? (isEditing ? 'Updating...' : 'Creating...') 
                    : (isEditing ? 'Update Agent' : 'Create Agent')
                  }
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AgentForm;