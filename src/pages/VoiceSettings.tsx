import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, TestTube } from 'lucide-react';
import VoiceInterface from '@/components/VoiceInterface';

interface Agent {
  id: string;
  name: string;
  system_prompt: string;
  openai_api_key: string | null;
  agent_configurations: {
    voice_settings: any;
  }[];
}

const VoiceSettings = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTest, setShowTest] = useState(false);
  
  const [formData, setFormData] = useState({
    voice: 'alloy',
    model: 'gpt-4o-realtime-preview-2024-12-17',
    speed: 1.0,
    language: 'en-US',
    openai_api_key: '',
    system_prompt: ''
  });

  const voices = [
    { value: 'alloy', label: 'Alloy' },
    { value: 'ash', label: 'Ash' },
    { value: 'ballad', label: 'Ballad' },
    { value: 'coral', label: 'Coral' },
    { value: 'echo', label: 'Echo' },
    { value: 'sage', label: 'Sage' },
    { value: 'shimmer', label: 'Shimmer' },
    { value: 'verse', label: 'Verse' }
  ];

  const models = [
    { value: 'gpt-4o-realtime-preview-2024-12-17', label: 'GPT-4o Realtime (Recommended)' },
    { value: 'gpt-4o-realtime-preview-2024-10-01', label: 'GPT-4o Realtime (Legacy)' }
  ];

  useEffect(() => {
    if (agentId) {
      loadAgent();
    }
  }, [agentId]);

  const loadAgent = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_agents')
        .select(`
          *,
          agent_configurations (
            voice_settings
          )
        `)
        .eq('id', agentId)
        .single();

      if (error) throw error;

      setAgent(data);
      
      const voiceSettings = (data.agent_configurations?.[0]?.voice_settings as any) || {};
      setFormData({
        voice: voiceSettings.voice || 'alloy',
        model: voiceSettings.model || 'gpt-4o-realtime-preview-2024-12-17',
        speed: voiceSettings.speed || 1.0,
        language: voiceSettings.language || 'en-US',
        openai_api_key: data.openai_api_key || '',
        system_prompt: data.system_prompt || ''
      });
    } catch (error) {
      console.error('Error loading agent:', error);
      toast({
        title: "Error",
        description: "Failed to load agent settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update agent
      const { error: agentError } = await supabase
        .from('ai_agents')
        .update({
          openai_api_key: formData.openai_api_key || null,
          system_prompt: formData.system_prompt
        })
        .eq('id', agentId);

      if (agentError) throw agentError;

      // Update or create agent configuration
      const voiceSettings = {
        voice: formData.voice,
        model: formData.model,
        speed: formData.speed,
        language: formData.language
      };

      // Check if configuration exists
      const { data: existingConfig } = await supabase
        .from('agent_configurations')
        .select('id')
        .eq('agent_id', agentId)
        .single();

      if (existingConfig) {
        // Update existing configuration
        const { error: configError } = await supabase
          .from('agent_configurations')
          .update({ voice_settings: voiceSettings })
          .eq('agent_id', agentId);

        if (configError) throw configError;
      } else {
        // Create new configuration
        const { error: configError } = await supabase
          .from('agent_configurations')
          .insert({
            agent_id: agentId,
            voice_settings: voiceSettings
          });

        if (configError) throw configError;
      }

      toast({
        title: "Success",
        description: "Voice settings saved successfully",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Agent Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested agent could not be found.</p>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Voice Settings</h1>
          <p className="text-muted-foreground">{agent.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Voice Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="voice">Voice</Label>
              <Select 
                value={formData.voice} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, voice: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select voice" />
                </SelectTrigger>
                <SelectContent>
                  {voices.map(voice => (
                    <SelectItem key={voice.value} value={voice.value}>
                      {voice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select 
                value={formData.model} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, model: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map(model => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="speed">Speech Speed</Label>
              <Input
                id="speed"
                type="number"
                min="0.5"
                max="2.0"
                step="0.1"
                value={formData.speed}
                onChange={(e) => setFormData(prev => ({ ...prev, speed: parseFloat(e.target.value) || 1.0 }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select 
                value={formData.language} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, language: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">OpenAI API Key (Optional)</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="sk-..."
                value={formData.openai_api_key}
                onChange={(e) => setFormData(prev => ({ ...prev, openai_api_key: e.target.value }))}
              />
              <p className="text-sm text-muted-foreground">
                Leave empty to use the default API key. Use your own key for better rate limits.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="system-prompt">System Prompt</Label>
              <Textarea
                id="system-prompt"
                placeholder="You are a helpful assistant..."
                value={formData.system_prompt}
                onChange={(e) => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
                rows={6}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4 mt-6">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Settings
        </Button>
        
        <Button 
          variant="outline" 
          onClick={() => setShowTest(!showTest)}
        >
          <TestTube className="w-4 h-4 mr-2" />
          {showTest ? 'Hide Test' : 'Test Voice'}
        </Button>
      </div>

      {showTest && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Test Voice Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <VoiceInterface agentId={agentId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VoiceSettings;