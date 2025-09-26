import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  Bot, 
  Settings, 
  TestTube, 
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import ClientSetupStep from './ClientSetupStep';
import AgentSetupStep from './AgentSetupStep';
import IntegrationSetupStep from './IntegrationSetupStep';
import TestingStep from './TestingStep';

interface WorkflowState {
  currentStep: number;
  clientId?: string;
  agentId?: string;
  integrations: string[];
  completed: boolean[];
}

const WorkflowWizard = () => {
  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    currentStep: 1,
    integrations: [],
    completed: [false, false, false, false]
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const steps = [
    {
      id: 1,
      title: "Client Setup",
      description: "Create and configure your client organization",
      icon: Users,
      component: ClientSetupStep
    },
    {
      id: 2,
      title: "AI Agent Configuration",
      description: "Set up your AI assistant with custom prompts",
      icon: Bot,
      component: AgentSetupStep
    },
    {
      id: 3,
      title: "Integration Setup",
      description: "Choose and configure your preferred integrations",
      icon: Settings,
      component: IntegrationSetupStep
    },
    {
      id: 4,
      title: "Testing & Deployment",
      description: "Test your setup and deploy to production",
      icon: TestTube,
      component: TestingStep
    }
  ];

  useEffect(() => {
    checkExistingSetup();
  }, []);

  const checkExistingSetup = async () => {
    try {
      setLoading(true);
      
      // Check for existing clients and agents
      const { data: clients } = await supabase
        .from('clients')
        .select('id')
        .limit(1);

      const { data: agents } = await supabase
        .from('ai_agents')
        .select('id, client_id')
        .limit(1);

      const { data: integrations } = await supabase
        .from('bland_integrations')
        .select('id')
        .limit(1);

      const { data: widgets } = await supabase
        .from('chat_widgets')
        .select('id')
        .limit(1);

      // Update workflow state based on existing data
      const completed = [false, false, false, false];
      let currentStep = 1;
      let clientId = clients?.[0]?.id;
      let agentId = agents?.[0]?.id;

      if (clients && clients.length > 0) {
        completed[0] = true;
        currentStep = 2;
      }

      if (agents && agents.length > 0) {
        completed[1] = true;
        currentStep = 3;
        clientId = agents[0].client_id;
        agentId = agents[0].id;
      }

      if ((integrations && integrations.length > 0) || (widgets && widgets.length > 0)) {
        completed[2] = true;
        currentStep = 4;
      }

      setWorkflowState({
        currentStep,
        clientId,
        agentId,
        integrations: integrations?.map(i => i.id) || [],
        completed
      });

    } catch (error) {
      console.error('Error checking existing setup:', error);
      toast({
        title: "Error",
        description: "Failed to load existing setup",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStepComplete = (stepIndex: number, data?: any) => {
    const newCompleted = [...workflowState.completed];
    newCompleted[stepIndex] = true;

    const newState: WorkflowState = {
      ...workflowState,
      completed: newCompleted,
      currentStep: Math.min(stepIndex + 2, steps.length)
    };

    // Update state based on step completion
    if (stepIndex === 0 && data?.clientId) {
      newState.clientId = data.clientId;
    } else if (stepIndex === 1 && data?.agentId) {
      newState.agentId = data.agentId;
    } else if (stepIndex === 2 && data?.integrations) {
      newState.integrations = data.integrations;
    }

    setWorkflowState(newState);

    toast({
      title: "Step Complete!",
      description: `${steps[stepIndex].title} has been completed successfully.`,
    });
  };

  const goToStep = (stepNumber: number) => {
    setWorkflowState({
      ...workflowState,
      currentStep: stepNumber
    });
  };

  const progress = (workflowState.completed.filter(Boolean).length / steps.length) * 100;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  const CurrentStepComponent = steps[workflowState.currentStep - 1]?.component;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-4">
          AI Service Setup Wizard
        </h2>
        <p className="text-muted-foreground text-lg mb-6">
          Complete setup of your AI voice assistant system
        </p>
        
        {/* Progress Bar */}
        <div className="max-w-md mx-auto">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">Progress</span>
            <span className="text-sm font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Step Navigation */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center space-x-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = workflowState.currentStep === step.id;
            const isCompleted = workflowState.completed[index];
            
            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => goToStep(step.id)}
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    isCompleted
                      ? 'bg-green-500 border-green-500 text-white'
                      : isActive
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted bg-background text-muted-foreground hover:border-primary'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </button>
                {index < steps.length - 1 && (
                  <div className={`w-8 h-0.5 mx-2 ${
                    workflowState.completed[index] ? 'bg-green-500' : 'bg-muted'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Step Content */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className={`flex items-center justify-center w-12 h-12 rounded-full ${
              workflowState.completed[workflowState.currentStep - 1]
                ? 'bg-green-500 text-white'
                : 'bg-primary text-primary-foreground'
            }`}>
              {workflowState.completed[workflowState.currentStep - 1] ? (
                <CheckCircle className="w-6 h-6" />
              ) : (
                React.createElement(steps[workflowState.currentStep - 1].icon, { className: "w-6 h-6" })
              )}
            </div>
            <div>
              <CardTitle className="text-xl">
                Step {workflowState.currentStep}: {steps[workflowState.currentStep - 1].title}
              </CardTitle>
              <CardDescription>
                {steps[workflowState.currentStep - 1].description}
              </CardDescription>
            </div>
            {workflowState.completed[workflowState.currentStep - 1] && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Complete
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {CurrentStepComponent && (
            <CurrentStepComponent
              workflowState={workflowState}
              onComplete={(data) => handleStepComplete(workflowState.currentStep - 1, data)}
              onNext={() => goToStep(Math.min(workflowState.currentStep + 1, steps.length))}
              onPrevious={() => goToStep(Math.max(workflowState.currentStep - 1, 1))}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => goToStep(Math.max(workflowState.currentStep - 1, 1))}
          disabled={workflowState.currentStep === 1}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>

        <div className="space-x-2">
          <Button
            variant="outline"
            onClick={() => navigate('/admin-panel')}
          >
            Skip Wizard
          </Button>
          
          <Button
            onClick={() => goToStep(Math.min(workflowState.currentStep + 1, steps.length))}
            disabled={workflowState.currentStep === steps.length}
          >
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowWizard;