import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Bot, CheckCircle, Settings, Wand2 } from 'lucide-react';

interface AgentSetupStepProps {
  workflowState: any;
  onComplete: (data: { agentId: string }) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const AgentSetupStep: React.FC<AgentSetupStepProps> = ({ 
  workflowState, 
  onComplete, 
  onNext 
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    system_prompt: '',
    template_type: 'general',
    openai_api_key: ''
  });
  const [loading, setLoading] = useState(false);
  const [clientName, setClientName] = useState('');
  const [existingAgents, setExistingAgents] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (workflowState.clientId) {
      loadClientInfo();
      loadExistingAgents();
    }
  }, [workflowState.clientId]);

  const loadClientInfo = async () => {
    try {
      const { data: client } = await supabase
        .from('clients')
        .select('name')
        .eq('id', workflowState.clientId)
        .single();

      if (client) {
        setClientName(client.name);
        // Set default agent name
        setFormData(prev => ({
          ...prev,
          name: `${client.name} Assistant`,
          description: `AI assistant for ${client.name}`,
          system_prompt: `You are a helpful AI assistant for ${client.name}. You provide excellent customer service and support. Be friendly, professional, and helpful in all interactions.`
        }));
      }
    } catch (error) {
      console.error('Error loading client info:', error);
    }
  };

  const loadExistingAgents = async () => {
    try {
      const { data: agents } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('client_id', workflowState.clientId)
        .order('created_at', { ascending: false });

      if (agents) {
        setExistingAgents(agents);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  };

  const generateSmartPrompt = () => {
    const smartPrompt = `You are an intelligent AI assistant for ${clientName}. Your role is to:

1. Provide exceptional customer service and support
2. Answer questions about ${clientName}'s products and services
3. Help users navigate and understand their options
4. Maintain a friendly, professional, and helpful tone
5. Escalate complex issues to human support when appropriate

Remember to:
- Be concise but thorough in your responses
- Ask clarifying questions when needed
- Always prioritize customer satisfaction
- Stay within your knowledge boundaries`;

    setFormData(prev => ({ ...prev, system_prompt: smartPrompt }));
    toast({
      title: "Smart Prompt Generated!",
      description: "A customized system prompt has been created for your agent.",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !workflowState.clientId) return;

    setLoading(true);
    try {
      const { data: agent, error } = await supabase
        .from('ai_agents')
        .insert({
          client_id: workflowState.clientId,
          name: formData.name.trim(),
          description: formData.description.trim(),
          system_prompt: formData.system_prompt.trim(),
          template_type: formData.template_type,
          openai_api_key: formData.openai_api_key.trim() || null,
          status: 'active',
          is_default: existingAgents.length === 0 // First agent becomes default
        })
        .select()
        .single();

      if (error) throw error;

      // Create agent configuration
      await supabase
        .from('agent_configurations')
        .insert({
          agent_id: agent.id
        });

      toast({
        title: "Success!",
        description: `AI Agent "${agent.name}" has been created successfully.`,
      });

      onComplete({ agentId: agent.id });
      
      setTimeout(() => {
        onNext();
      }, 1500);

    } catch (error: any) {
      console.error('Error creating agent:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create agent",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectExistingAgent = (agent: any) => {
    onComplete({ agentId: agent.id });
    toast({
      title: "Agent Selected!",
      description: `Using existing agent "${agent.name}".`,
    });
    setTimeout(() => {
      onNext();
    }, 1000);
  };

  // If step is already completed, show completion state
  if (workflowState.completed[1]) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Agent Setup Complete!</h3>
        <p className="text-muted-foreground mb-4">
          Your AI agent has been successfully configured.
        </p>
        <Button onClick={onNext}>
          Continue to Integration Setup →
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Existing Agents */}
      {existingAgents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bot className="h-5 w-5 mr-2" />
              Use Existing Agent
            </CardTitle>
            <CardDescription>
              Select from existing agents for {clientName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {existingAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <h4 className="font-medium">{agent.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {agent.description || 'No description'}
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => selectExistingAgent(agent)}
                  >
                    Select
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create New Agent */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Configure AI Agent for {clientName}
          </CardTitle>
          <CardDescription>
            Set up your AI assistant with custom behavior and responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Agent Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter agent name"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the agent's purpose"
              />
            </div>

            <div>
              <Label htmlFor="template_type">Template Type</Label>
              <Select value={formData.template_type} onValueChange={(value) => setFormData({ ...formData, template_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General Support</SelectItem>
                  <SelectItem value="sales">Sales Assistant</SelectItem>
                  <SelectItem value="technical">Technical Support</SelectItem>
                  <SelectItem value="customer_service">Customer Service</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="system_prompt">System Prompt *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateSmartPrompt}
                >
                  <Wand2 className="h-4 w-4 mr-1" />
                  Generate Smart Prompt
                </Button>
              </div>
              <Textarea
                id="system_prompt"
                value={formData.system_prompt}
                onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                placeholder="Define how your AI agent should behave and respond..."
                rows={8}
                required
              />
            </div>

            <div>
              <Label htmlFor="openai_api_key">OpenAI API Key (Optional)</Label>
              <Input
                id="openai_api_key"
                type="password"
                value={formData.openai_api_key}
                onChange={(e) => setFormData({ ...formData, openai_api_key: e.target.value })}
                placeholder="sk-... (leave empty to use system default)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Provide your own OpenAI API key for dedicated usage and billing
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || !formData.name.trim() || !formData.system_prompt.trim()}
            >
              {loading ? "Creating Agent..." : "Create Agent & Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <h4 className="font-medium mb-2">Pro Tips</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Use the "Generate Smart Prompt" to create a tailored system prompt</li>
            <li>• The system prompt defines your agent's personality and capabilities</li>
            <li>• You can always modify these settings later in the agent configuration</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentSetupStep;
