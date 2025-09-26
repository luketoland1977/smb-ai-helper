import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Separator } from '@/components/ui/separator';
import { Phone, Volume2, VolumeX } from 'lucide-react';

interface VoiceSettings {
  voice?: string;
  language?: string;
  greeting_message?: string;
  skip_greeting?: boolean;
  greeting_voice?: string;
  openai_voice?: string;
  audio_quality?: string;
  noise_suppression?: boolean;
}

interface TwilioIntegration {
  id: string;
  phone_number: string;
  voice_settings: Record<string, any>;
  clients?: { name: string };
  ai_agents?: { name: string };
}

interface TwilioGreetingConfigProps {
  integration: TwilioIntegration;
  onUpdate: (id: string, settings: Record<string, any>) => void;
}

const TWILIO_VOICES = [
  { value: 'Google.en-US-Chirp3-HD-Aoede', label: 'Google Chirp3 HD - Aoede' },
  { value: 'Google.en-US-Chirp2-HD-Baila', label: 'Google Chirp2 HD - Baila' },
  { value: 'Google.en-US-Chirp-HD-Calliope', label: 'Google Chirp HD - Calliope' },
  { value: 'Polly.Joanna', label: 'Amazon Polly - Joanna' },
  { value: 'Polly.Matthew', label: 'Amazon Polly - Matthew' },
  { value: 'Polly.Amy', label: 'Amazon Polly - Amy' },
  { value: 'alice', label: 'Twilio Alice' },
  { value: 'man', label: 'Twilio Man' },
  { value: 'woman', label: 'Twilio Woman' },
];

const OPENAI_VOICES = [
  { value: 'alloy', label: 'Alloy (Default)' },
  { value: 'echo', label: 'Echo' },
  { value: 'fable', label: 'Fable' },
  { value: 'onyx', label: 'Onyx' },
  { value: 'nova', label: 'Nova' },
  { value: 'shimmer', label: 'Shimmer' },
];

const AUDIO_QUALITY_OPTIONS = [
  { value: 'standard', label: 'Standard Quality' },
  { value: 'enhanced', label: 'Enhanced Quality' },
  { value: 'premium', label: 'Premium Quality' },
];

const TwilioGreetingConfig: React.FC<TwilioGreetingConfigProps> = ({ integration, onUpdate }) => {
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(integration.voice_settings || {});
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('twilio_integrations')
        .update({ voice_settings: voiceSettings as any })
        .eq('id', integration.id);

      if (error) throw error;

      onUpdate(integration.id, voiceSettings);
      toast({
        title: "Settings Updated",
        description: "Greeting configuration has been saved successfully.",
      });
    } catch (error) {
      console.error('Error updating voice settings:', error);
      toast({
        title: "Error",
        description: "Failed to update greeting settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateTwiMLPreview = () => {
    const greetingMessage = voiceSettings.greeting_message || "Hello! I'm connecting you to your AI assistant.";
    const greetingVoice = voiceSettings.greeting_voice || "Google.en-US-Chirp3-HD-Aoede";
    const audioQuality = voiceSettings.audio_quality || 'enhanced';
    
    // Enhanced TwiML with audio quality settings
    const audioSettings = audioQuality === 'premium' 
      ? 'audioCodec="PCMU" enableOnHold="true" statusCallback="https://webhook.example.com/status"'
      : audioQuality === 'enhanced'
      ? 'audioCodec="PCMU" enableOnHold="true"'
      : 'audioCodec="PCMU"';
    
    if (voiceSettings.skip_greeting) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="wss://nodejs-server-production.up.railway.app/media-stream?phone=${encodeURIComponent(integration.phone_number)}" />
    </Connect>
</Response>`;
    }
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="${greetingVoice}" language="en-US">${greetingMessage}</Say>
    <Connect>
        <Stream url="wss://nodejs-server-production.up.railway.app/media-stream?phone=${encodeURIComponent(integration.phone_number)}" ${audioSettings} />
    </Connect>
</Response>`;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-lg">Phone Greeting Configuration</CardTitle>
            <CardDescription>
              {integration.phone_number} • {integration.ai_agents?.name || 'Default Agent'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Skip Greeting Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            {voiceSettings.skip_greeting ? (
              <VolumeX className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Volume2 className="h-5 w-5 text-primary" />
            )}
            <div>
              <Label className="text-sm font-medium">Skip Initial Greeting</Label>
              <p className="text-xs text-muted-foreground">
                Connect callers directly to the AI assistant without a greeting
              </p>
            </div>
          </div>
          <Switch
            checked={voiceSettings.skip_greeting || false}
            onCheckedChange={(checked) => 
              setVoiceSettings(prev => ({ ...prev, skip_greeting: checked }))
            }
          />
        </div>

        {/* Greeting Configuration */}
        {!voiceSettings.skip_greeting && (
          <>
            <Separator />
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="greeting-message" className="text-sm font-medium">
                  Greeting Message
                </Label>
                <Textarea
                  id="greeting-message"
                  placeholder="Hello! I'm connecting you to your AI assistant."
                  value={voiceSettings.greeting_message || ''}
                  onChange={(e) => 
                    setVoiceSettings(prev => ({ ...prev, greeting_message: e.target.value }))
                  }
                  className="mt-2"
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum 200 characters. This message will be spoken when someone calls.
                </p>
              </div>

              <div>
                <Label htmlFor="greeting-voice" className="text-sm font-medium">
                  Greeting Voice
                </Label>
                <Select
                  value={voiceSettings.greeting_voice || 'Google.en-US-Chirp3-HD-Aoede'}
                  onValueChange={(value) => 
                    setVoiceSettings(prev => ({ ...prev, greeting_voice: value }))
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TWILIO_VOICES.map((voice) => (
                      <SelectItem key={voice.value} value={voice.value}>
                        {voice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Choose the voice that will speak the greeting message
                </p>
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* TwiML Preview */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Generated TwiML Preview</Label>
          <div className="bg-muted p-3 rounded-lg overflow-x-auto">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
              {generateTwiMLPreview()}
            </pre>
          </div>
        </div>

        {/* AI Voice & Audio Quality Settings */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">AI Assistant Audio Settings</Label>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="openai-voice" className="text-sm font-medium">
                AI Voice
              </Label>
              <Select
                value={voiceSettings.openai_voice || 'alloy'}
                onValueChange={(value) => 
                  setVoiceSettings(prev => ({ ...prev, openai_voice: value }))
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPENAI_VOICES.map((voice) => (
                    <SelectItem key={voice.value} value={voice.value}>
                      {voice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Choose the AI assistant's voice for the conversation
              </p>
            </div>

            <div>
              <Label htmlFor="audio-quality" className="text-sm font-medium">
                Audio Quality
              </Label>
              <Select
                value={voiceSettings.audio_quality || 'enhanced'}
                onValueChange={(value) => 
                  setVoiceSettings(prev => ({ ...prev, audio_quality: value }))
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIO_QUALITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Higher quality may increase latency slightly
              </p>
            </div>
          </div>

          {/* Noise Suppression Toggle */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label className="text-sm font-medium">Enhanced Noise Suppression</Label>
              <p className="text-xs text-muted-foreground">
                Reduces background noise and improves call clarity
              </p>
            </div>
            <Switch
              checked={voiceSettings.noise_suppression !== false}
              onCheckedChange={(checked) => 
                setVoiceSettings(prev => ({ ...prev, noise_suppression: checked }))
              }
            />
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={loading} className="flex-1">
            {loading ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TwilioGreetingConfig;