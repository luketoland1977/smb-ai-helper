import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import VoiceInterface from '@/components/VoiceInterface';
import { Phone, Globe, Mic, Users, ArrowRight, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const VoiceDemo = () => {
  const { toast } = useToast();
  const [selectedDemo, setSelectedDemo] = useState<'phone' | 'web' | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Information copied to clipboard",
    });
  };

  const demoPhoneNumber = "(844) 415-2896";
  const demoEmbedCode = `<!-- AI Voice Assistant Widget -->
<script>
  window.voiceWidgetConfig = {
    clientId: 'demo-client',
    agentId: 'demo-agent',
    position: 'bottom-right',
    primaryColor: '#2563eb'
  };
</script>
<script src="${window.location.origin}/voice-widget.js"></script>`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              AI Voice Assistant Demo
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Experience our AI voice technology through phone calls or web widgets. 
              Perfect for customer service, support, and lead generation.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Demo Options */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          
          {/* Phone Demo */}
          <Card className={`cursor-pointer transition-all duration-200 ${selectedDemo === 'phone' ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:shadow-md'}`}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-4">
                <Phone className="w-8 h-8 text-blue-600" />
                <div>
                  <CardTitle className="text-2xl">Phone Integration</CardTitle>
                  <CardDescription className="text-base">
                    Call our AI-powered phone number for instant voice assistance
                  </CardDescription>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Works on any phone (mobile/landline)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>No app download required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Perfect for customer support lines</span>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="bg-gray-50 rounded-lg p-6 text-center mb-6">
                <h3 className="font-semibold text-lg mb-2">Demo Phone Number</h3>
                <div 
                  className="text-3xl font-bold text-blue-600 cursor-pointer hover:text-blue-700"
                  onClick={() => copyToClipboard(demoPhoneNumber)}
                >
                  {demoPhoneNumber}
                </div>
                <p className="text-sm text-gray-600 mt-2">Click to copy • Available 24/7</p>
              </div>

              <div className="space-y-3">
                <Button 
                  className="w-full" 
                  onClick={() => setSelectedDemo(selectedDemo === 'phone' ? null : 'phone')}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  {selectedDemo === 'phone' ? 'Hide Details' : 'Try Phone Demo'}
                </Button>
                
                {selectedDemo === 'phone' && (
                  <div className="bg-blue-50 rounded-lg p-4 space-y-2 text-sm">
                    <h4 className="font-semibold text-blue-900">How to test:</h4>
                    <div className="space-y-1 text-blue-800">
                      <p>1. Call {demoPhoneNumber} from any phone</p>
                      <p>2. Wait for the AI greeting</p>
                      <p>3. Speak naturally - ask questions or request help</p>
                      <p>4. The AI will respond in real-time</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Web Widget Demo */}
          <Card className={`cursor-pointer transition-all duration-200 ${selectedDemo === 'web' ? 'ring-2 ring-purple-500 shadow-lg' : 'hover:shadow-md'}`}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-4">
                <Globe className="w-8 h-8 text-purple-600" />
                <div>
                  <CardTitle className="text-2xl">Web Widget</CardTitle>
                  <CardDescription className="text-base">
                    Embed voice AI directly on your website for visitors
                  </CardDescription>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Easy website integration</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Customizable appearance</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Captures leads automatically</span>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-4">
                <Button 
                  className="w-full bg-purple-600 hover:bg-purple-700" 
                  onClick={() => setSelectedDemo(selectedDemo === 'web' ? null : 'web')}
                >
                  <Mic className="w-4 h-4 mr-2" />
                  {selectedDemo === 'web' ? 'Hide Widget' : 'Try Web Widget'}
                </Button>
                
                {selectedDemo === 'web' && (
                  <div className="space-y-4">
                    <VoiceInterface 
                      onSpeakingChange={(speaking) => console.log('Speaking:', speaking)}
                    />
                    
                    <div className="bg-purple-50 rounded-lg p-4">
                      <h4 className="font-semibold text-purple-900 mb-2">Integration Code:</h4>
                      <div className="bg-gray-800 text-green-400 p-3 rounded text-xs font-mono overflow-x-auto">
                        <pre>{demoEmbedCode}</pre>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => copyToClipboard(demoEmbedCode)}
                      >
                        Copy Code
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Features Comparison */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-3xl font-bold text-center mb-8">Feature Comparison</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-4 px-4">Feature</th>
                  <th className="text-center py-4 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <Phone className="w-5 h-5 text-blue-600" />
                      <span>Phone Integration</span>
                    </div>
                  </th>
                  <th className="text-center py-4 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <Globe className="w-5 h-5 text-purple-600" />
                      <span>Web Widget</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="space-y-2">
                <tr className="border-b">
                  <td className="py-4 px-4 font-medium">Setup Complexity</td>
                  <td className="py-4 px-4 text-center">
                    <Badge variant="outline" className="bg-green-50 text-green-700">Simple</Badge>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Medium</Badge>
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-4 font-medium">Device Compatibility</td>
                  <td className="py-4 px-4 text-center">
                    <Badge variant="outline" className="bg-green-50 text-green-700">Universal</Badge>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">Modern Browsers</Badge>
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-4 font-medium">Lead Capture</td>
                  <td className="py-4 px-4 text-center">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">Phone Number</Badge>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <Badge variant="outline" className="bg-green-50 text-green-700">Full Details</Badge>
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-medium">Use Cases</td>
                  <td className="py-4 px-4 text-center text-sm">Support Lines, Sales</td>
                  <td className="py-4 px-4 text-center text-sm">Website Visitors, FAQ</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl text-white p-8 text-center mt-12">
          <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Customer Experience?</h2>
          <p className="text-xl mb-6 opacity-90">
            Deploy AI voice assistants in minutes, not months. Start with either phone or web integration.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
              <Users className="w-5 h-5 mr-2" />
              Schedule Demo Call
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600">
              <ArrowRight className="w-5 h-5 mr-2" />
              Get Started Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceDemo;