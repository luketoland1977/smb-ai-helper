import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  MessageSquare, 
  Phone, 
  Mic, 
  Globe, 
  CheckCircle, 
  ExternalLink,
  Settings,
  Zap
} from 'lucide-react';
import { BlandIntegrationForm } from '@/components/BlandIntegrationForm';

interface IntegrationSetupStepProps {
  workflowState: any;
  onComplete: (data: { integrations: string[] }) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const IntegrationSetupStep: React.FC<IntegrationSetupStepProps> = ({ 
  workflowState, 
  onComplete, 
  onNext 
}) => {
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [clientInfo, setClientInfo] = useState<any>(null);
  const [agentInfo, setAgentInfo] = useState<any>(null);
  const [existingIntegrations, setExistingIntegrations] = useState<any>({});
  const { toast } = useToast();

  useEffect(() => {
    if (workflowState.clientId && workflowState.agentId) {
      loadSetupInfo();
      checkExistingIntegrations();
    }
  }, [workflowState.clientId, workflowState.agentId]);

  const loadSetupInfo = async () => {
    try {
      const [clientRes, agentRes] = await Promise.all([
        supabase.from('clients').select('*').eq('id', workflowState.clientId).single(),
        supabase.from('ai_agents').select('*').eq('id', workflowState.agentId).single()
      ]);

      if (clientRes.data) setClientInfo(clientRes.data);
      if (agentRes.data) setAgentInfo(agentRes.data);
    } catch (error) {
      console.error('Error loading setup info:', error);
    }
  };

  const checkExistingIntegrations = async () => {
    try {
      const [chatWidgets, voiceWidgets, blandIntegrations, twilioIntegrations] = await Promise.all([
        supabase.from('chat_widgets').select('*').eq('client_id', workflowState.clientId),
        supabase.from('voice_widgets').select('*').eq('client_id', workflowState.clientId),
        supabase.from('bland_integrations').select('*').eq('client_id', workflowState.clientId),
        supabase.from('twilio_integrations').select('*').eq('client_id', workflowState.clientId)
      ]);

      setExistingIntegrations({
        chatWidget: chatWidgets.data?.[0],
        voiceWidget: voiceWidgets.data?.[0],
        blandIntegration: blandIntegrations.data?.[0],
        twilioIntegration: twilioIntegrations.data?.[0]
      });

      // Auto-select existing integrations
      const existing = [];
      if (chatWidgets.data?.length) existing.push('chat-widget');
      if (voiceWidgets.data?.length) existing.push('voice-widget');
      if (blandIntegrations.data?.length) existing.push('bland-ai');
      if (twilioIntegrations.data?.length) existing.push('twilio');
      
      setSelectedIntegrations(existing);
    } catch (error) {
      console.error('Error checking existing integrations:', error);
    }
  };

  const createChatWidget = async () => {
    try {
      const embedCode = `<script src="https://ycvvuepfsebqpwmamqgg.supabase.co/storage/v1/object/public/widgets/widget.js" data-client-id="${workflowState.clientId}" data-agent-id="${workflowState.agentId}"></script>`;
      
      const { error } = await supabase
        .from('chat_widgets')
        .insert({
          client_id: workflowState.clientId,
          agent_id: workflowState.agentId,
          widget_name: `${clientInfo?.name} Chat Widget`,
          embed_code: embedCode,
          widget_config: {
            theme: "default",
            position: "bottom-right",
            primaryColor: "#3b82f6",
            textColor: "#ffffff"
          },
          is_active: true
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error creating chat widget:', error);
      return false;
    }
  };

  const createVoiceWidget = async () => {
    try {
      const widgetCode = `<script src="https://ycvvuepfsebqpwmamqgg.supabase.co/storage/v1/object/public/widgets/voice-widget.js" data-client-id="${workflowState.clientId}" data-agent-id="${workflowState.agentId}"></script>`;
      
      const { error } = await supabase
        .from('voice_widgets')
        .insert({
          client_id: workflowState.clientId,
          agent_id: workflowState.agentId,
          widget_name: `${clientInfo?.name} Voice Widget`,
          widget_code: widgetCode,
          voice_settings: {
            voice: "alloy",
            speed: 1.0,
            language: "en-US"
          },
          is_active: true
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error creating voice widget:', error);
      return false;
    }
  };

  const handleIntegrationComplete = async () => {
    setLoading(true);
    try {
      const completedIntegrations = [...selectedIntegrations];

      // Create selected integrations
      if (selectedIntegrations.includes('chat-widget') && !existingIntegrations.chatWidget) {
        await createChatWidget();
      }

      if (selectedIntegrations.includes('voice-widget') && !existingIntegrations.voiceWidget) {
        await createVoiceWidget();
      }

      toast({
        title: "Integrations Setup Complete!",
        description: "Your selected integrations have been configured successfully.",
      });

      onComplete({ integrations: completedIntegrations });
      
      setTimeout(() => {
        onNext();
      }, 1500);

    } catch (error: any) {
      console.error('Error setting up integrations:', error);
      toast({
        title: "Error",
        description: "Failed to set up some integrations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleIntegration = (integration: string) => {
    setSelectedIntegrations(prev => 
      prev.includes(integration) 
        ? prev.filter(i => i !== integration)
        : [...prev, integration]
    );
  };

  // If step is already completed, show completion state
  if (workflowState.completed[2]) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Integrations Setup Complete!</h3>
        <p className="text-muted-foreground mb-4">
          Your integrations have been successfully configured.
        </p>
        <Button onClick={onNext}>
          Continue to Testing →
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">
          Choose Your Integration Options
        </h3>
        <p className="text-muted-foreground">
          Select the integrations you want to set up for {clientInfo?.name}
        </p>
      </div>

      <Tabs defaultValue="widgets" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="widgets">Web Widgets</TabsTrigger>
          <TabsTrigger value="phone">Phone Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="widgets" className="space-y-4">
          {/* Chat Widget */}
          <Card className={`cursor-pointer transition-all ${
            selectedIntegrations.includes('chat-widget') ? 'ring-2 ring-primary' : ''
          }`} onClick={() => toggleIntegration('chat-widget')}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <MessageSquare className="h-8 w-8 text-blue-500" />
                  <div>
                    <CardTitle>Chat Widget</CardTitle>
                    <CardDescription>Text-based chat interface for websites</CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {existingIntegrations.chatWidget && (
                    <Badge variant="secondary">Existing</Badge>
                  )}
                  {selectedIntegrations.includes('chat-widget') ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <div className="h-5 w-5 border-2 border-muted rounded-full" />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Easy website integration with embed code</li>
                <li>• Customizable themes and positioning</li>
                <li>• Real-time customer support</li>
              </ul>
            </CardContent>
          </Card>

          {/* Voice Widget */}
          <Card className={`cursor-pointer transition-all ${
            selectedIntegrations.includes('voice-widget') ? 'ring-2 ring-primary' : ''
          }`} onClick={() => toggleIntegration('voice-widget')}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Mic className="h-8 w-8 text-purple-500" />
                  <div>
                    <CardTitle>Voice Widget</CardTitle>
                    <CardDescription>Voice-enabled chat interface for websites</CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {existingIntegrations.voiceWidget && (
                    <Badge variant="secondary">Existing</Badge>
                  )}
                  {selectedIntegrations.includes('voice-widget') ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <div className="h-5 w-5 border-2 border-muted rounded-full" />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Voice-to-voice conversations</li>
                <li>• Powered by OpenAI real-time API</li>
                <li>• Natural speech interactions</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="phone" className="space-y-4">
          {/* Bland AI Integration */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Phone className="h-8 w-8 text-green-500" />
                <div>
                  <CardTitle>Bland AI Phone Integration</CardTitle>
                  <CardDescription>Automated phone calls and inbound number management</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {existingIntegrations.blandIntegration ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-sm">Bland AI integration already configured</span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => window.open('/voice-settings', '_blank')}
                    className="w-full"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Bland AI Settings
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              ) : (
                <BlandIntegrationForm
                  clientId={workflowState.clientId}
                  agents={agentInfo ? [{ id: agentInfo.id, name: agentInfo.name }] : []}
                  onSuccess={() => {
                    toast({
                      title: "Bland AI Integration Complete!",
                      description: "Your phone integration has been set up successfully.",
                    });
                    setSelectedIntegrations(prev => [...prev, 'bland-ai']);
                    checkExistingIntegrations();
                  }}
                />
              )}
            </CardContent>
          </Card>

          {/* Twilio Integration */}
          <Card className="opacity-60">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Zap className="h-8 w-8 text-orange-500" />
                <div>
                  <CardTitle>Twilio + OpenAI Integration</CardTitle>
                  <CardDescription>Direct Twilio phone integration with OpenAI real-time API</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <Badge variant="secondary">Coming Soon</Badge>
                <p className="text-sm text-muted-foreground mt-2">
                  Advanced Twilio integration with OpenAI real-time capabilities
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Button */}
      <div className="text-center">
        <Button 
          onClick={handleIntegrationComplete}
          disabled={loading || selectedIntegrations.length === 0}
          size="lg"
          className="w-full max-w-md"
        >
          {loading ? "Setting up integrations..." : "Complete Integration Setup"}
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          {selectedIntegrations.length} integration(s) selected
        </p>
      </div>
    </div>
  );
};

export default IntegrationSetupStep;