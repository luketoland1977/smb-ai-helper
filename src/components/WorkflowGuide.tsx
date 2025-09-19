import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Bot, 
  Globe, 
  TestTube, 
  BarChart3, 
  ArrowRight, 
  CheckCircle,
  Phone,
  Mic
} from 'lucide-react';

const WorkflowGuide = () => {
  const navigate = useNavigate();

  const steps = [
    {
      id: 1,
      title: "Create Your Client",
      description: "Set up your client organization with domain and settings",
      icon: Users,
      action: "Create Client",
      route: "/clients/new",
      color: "bg-blue-500",
      completed: false
    },
    {
      id: 2,
      title: "Create AI Agent",
      description: "Configure your AI assistant with custom system prompts",
      icon: Bot,
      action: "Create Agent",
      route: "/agents/new",
      color: "bg-green-500",
      completed: false
    },
    {
      id: 3,
      title: "Generate Voice Widget",
      description: "Create voice widgets for web integration and phone setup",
      icon: Globe,
      action: "Create Widgets",
      route: "/widgets",
      color: "bg-purple-500",
      completed: false
    },
    {
      id: 4,
      title: "Test Voice Integration",
      description: "Try phone calls and web widget voice interactions",
      icon: TestTube,
      action: "Test Voice",
      route: "/voice-demo",
      color: "bg-orange-500",
      completed: false
    },
    {
      id: 5,
      title: "Monitor & Manage",
      description: "View conversations, manage agents, and analyze performance",
      icon: BarChart3,
      action: "View Dashboard",
      route: "/dashboard",
      color: "bg-indigo-500",
      completed: false
    }
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-4">
          Voice Integration Workflow
        </h2>
        <p className="text-muted-foreground text-lg">
          Follow these steps to set up your complete AI voice assistant system
        </p>
      </div>

      <div className="space-y-6">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <Card key={step.id} className="relative overflow-hidden">
              <div className={`absolute left-0 top-0 w-1 h-full ${step.color}`} />
              
              <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                <div className={`flex items-center justify-center w-12 h-12 rounded-full ${step.color} text-white mr-4`}>
                  <Icon className="w-6 h-6" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-xl">
                      Step {step.id}: {step.title}
                    </CardTitle>
                    {step.completed && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Complete
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-base mt-1">
                    {step.description}
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {step.id === 1 && (
                      <div className="text-sm text-muted-foreground">
                        • Set client name and domain<br/>
                        • Configure organization settings<br/>
                        • Establish client-user relationships
                      </div>
                    )}
                    {step.id === 2 && (
                      <div className="text-sm text-muted-foreground">
                        • Choose client association<br/>
                        • Write custom system prompts<br/>
                        • Set agent name and description
                      </div>
                    )}
                    {step.id === 3 && (
                      <div className="text-sm text-muted-foreground">
                        • Create voice widgets for websites<br/>
                        • Set up Twilio phone integration<br/>
                        • Generate embed codes
                      </div>
                    )}
                    {step.id === 4 && (
                      <div className="text-sm text-muted-foreground">
                        • Test phone integration: (844) 415-2896<br/>
                        • Try web widget voice interface<br/>
                        • Verify real-time responses
                      </div>
                    )}
                    {step.id === 5 && (
                      <div className="text-sm text-muted-foreground">
                        • View client and agent metrics<br/>
                        • Monitor active conversations<br/>
                        • Manage widget configurations
                      </div>
                    )}
                  </div>
                  
                  <Button 
                    onClick={() => navigate(step.route)}
                    className="ml-4"
                    variant={index === 0 ? "default" : "outline"}
                  >
                    {step.action}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Links */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-800">
              <Phone className="w-5 h-5 mr-2" />
              Phone Integration Ready
            </CardTitle>
            <CardDescription className="text-blue-600">
              Call (844) 415-2896 to test AI voice responses instantly
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={() => navigate('/voice-demo')}
            >
              Try Phone Demo
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center text-purple-800">
              <Mic className="w-5 h-5 mr-2" />
              Web Widget Available
            </CardTitle>
            <CardDescription className="text-purple-600">
              Voice-enabled widgets ready for website integration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
              onClick={() => navigate('/widgets')}
            >
              Create Widget
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WorkflowGuide;