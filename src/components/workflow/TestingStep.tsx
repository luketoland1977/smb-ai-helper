import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  CheckCircle, 
  ExternalLink, 
  Phone, 
  MessageSquare, 
  Mic, 
  Copy,
  TestTube,
  Rocket,
  BarChart3
} from 'lucide-react';

interface TestingStepProps {
  workflowState: any;
  onComplete: (data?: any) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const TestingStep: React.FC<TestingStepProps> = ({ 
  workflowState, 
  onComplete 
}) => {
  const [integrations, setIntegrations] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<{[key: string]: boolean}>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadIntegrations();
  }, [workflowState.clientId]);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      
      const [client, chatWidgets, voiceWidgets, blandIntegrations] = await Promise.all([
        supabase.from('clients').select('*').eq('id', workflowState.clientId).single(),
        supabase.from('chat_widgets').select('*').eq('client_id', workflowState.clientId),
        supabase.from('voice_widgets').select('*').eq('client_id', workflowState.clientId),
        supabase.from('bland_integrations').select('*').eq('client_id', workflowState.clientId)
      ]);

      setIntegrations({
        client: client.data,
        chatWidget: chatWidgets.data?.[0],
        voiceWidget: voiceWidgets.data?.[0],
        blandIntegration: blandIntegrations.data?.[0]
      });

    } catch (error) {
      console.error('Error loading integrations:', error);
      toast({
        title: "Error",
        description: "Failed to load integration details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const markTestComplete = (testType: string) => {
    setTestResults(prev => ({ ...prev, [testType]: true }));
    toast({
      title: "Test Completed!",
      description: `${testType} test has been marked as successful.`,
    });
  };

  const completeWorkflow = () => {
    onComplete();
    toast({
      title: "Workflow Complete! 🎉",
      description: "Your AI service setup is now complete and ready for production.",
    });
    
    setTimeout(() => {
      navigate('/admin-panel');
    }, 2000);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground mt-4">Loading integration details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <TestTube className="h-16 w-16 mx-auto mb-4 text-primary" />
        <h3 className="text-xl font-semibold mb-2">Test Your Setup</h3>
        <p className="text-muted-foreground">
          Verify that all integrations are working correctly before going live
        </p>
      </div>

      {/* Chat Widget Testing */}
      {integrations.chatWidget && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <MessageSquare className="h-6 w-6 text-blue-500" />
                <div>
                  <CardTitle>Chat Widget</CardTitle>
                  <CardDescription>Test your website chat integration</CardDescription>
                </div>
              </div>
              {testResults.chatWidget && (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Tested
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Embed Code</h4>
              <div className="relative">
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                  <code>{integrations.chatWidget.embed_code}</code>
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(integrations.chatWidget.embed_code, "Embed code")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigate(`/chat/${workflowState.agentId}`)}
                className="flex-1"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Test Chat
              </Button>
              <Button
                onClick={() => markTestComplete('Chat Widget')}
                disabled={testResults.chatWidget}
                variant={testResults.chatWidget ? "secondary" : "default"}
              >
                {testResults.chatWidget ? "Tested" : "Mark as Tested"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Voice Widget Testing */}
      {integrations.voiceWidget && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Mic className="h-6 w-6 text-purple-500" />
                <div>
                  <CardTitle>Voice Widget</CardTitle>
                  <CardDescription>Test your website voice integration</CardDescription>
                </div>
              </div>
              {testResults.voiceWidget && (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Tested
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Widget Code</h4>
              <div className="relative">
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                  <code>{integrations.voiceWidget.widget_code}</code>
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(integrations.voiceWidget.widget_code, "Widget code")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigate('/voice-demo')}
                className="flex-1"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Test Voice Demo
              </Button>
              <Button
                onClick={() => markTestComplete('Voice Widget')}
                disabled={testResults.voiceWidget}
                variant={testResults.voiceWidget ? "secondary" : "default"}
              >
                {testResults.voiceWidget ? "Tested" : "Mark as Tested"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bland AI Phone Integration Testing */}
      {integrations.blandIntegration && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Phone className="h-6 w-6 text-green-500" />
                <div>
                  <CardTitle>Bland AI Phone Integration</CardTitle>
                  <CardDescription>Test your phone integration</CardDescription>
                </div>
              </div>
              {testResults.blandIntegration && (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Tested
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Phone Number</h4>
              <div className="flex items-center justify-between bg-muted p-3 rounded">
                <span className="font-mono text-lg">{integrations.blandIntegration.phone_number}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(integrations.blandIntegration.phone_number, "Phone number")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigate('/voice-settings')}
                className="flex-1"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Manage Settings
              </Button>
              <Button
                onClick={() => markTestComplete('Bland AI Integration')}
                disabled={testResults.blandIntegration}
                variant={testResults.blandIntegration ? "secondary" : "default"}
              >
                {testResults.blandIntegration ? "Tested" : "Mark as Tested"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completion Actions */}
      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center text-green-800">
            <Rocket className="h-6 w-6 mr-2" />
            Ready for Production
          </CardTitle>
          <CardDescription className="text-green-600">
            Your AI service setup is complete and ready to serve customers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={() => navigate('/admin-panel')}
              variant="outline"
              className="border-green-300 text-green-700 hover:bg-green-50"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              View Dashboard
            </Button>
            <Button
              onClick={() => navigate('/widgets')}
              variant="outline"
              className="border-green-300 text-green-700 hover:bg-green-50"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Manage Widgets
            </Button>
          </div>
          
          <Button 
            onClick={completeWorkflow}
            className="w-full bg-green-600 hover:bg-green-700"
            size="lg"
          >
            <CheckCircle className="h-5 w-5 mr-2" />
            Complete Setup & Go Live
          </Button>
        </CardContent>
      </Card>

      {/* Next Steps Info */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <h4 className="font-medium mb-2">What's Next?</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Monitor conversations and performance in the dashboard</li>
            <li>• Upload documents to the knowledge base for better responses</li>
            <li>• Customize agent settings and voice configurations</li>
            <li>• Set up additional integrations as needed</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestingStep;