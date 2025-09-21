import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Clock, Phone, Music, TestTube, BarChart3 } from "lucide-react";

interface BlandAdvancedSettingsProps {
  integrationId: string;
  clientId: string;
}

export const BlandAdvancedSettings = ({ integrationId, clientId }: BlandAdvancedSettingsProps) => {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    interruption_threshold: 50,
    voicemail_detection: true,
    silence_timeout: 4,
    max_call_duration: 1800,
    transfer_phone_number: '',
    custom_greeting: '',
    hold_music_url: '',
    time_based_rules: {},
    a_b_test_config: {},
    analytics_config: {},
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchAdvancedSettings();
  }, [integrationId]);

  const fetchAdvancedSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('bland_advanced_settings')
        .select('*')
        .eq('integration_id', integrationId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setSettings({
          interruption_threshold: data.interruption_threshold || 50,
          voicemail_detection: data.voicemail_detection ?? true,
          silence_timeout: data.silence_timeout || 4,
          max_call_duration: data.max_call_duration || 1800,
          transfer_phone_number: (data.transfer_settings as any)?.phone_number || '',
          custom_greeting: data.custom_greeting || '',
          hold_music_url: data.hold_music_url || '',
          time_based_rules: data.time_based_rules || {},
          a_b_test_config: data.a_b_test_config || {},
          analytics_config: data.analytics_config || {},
        });
      }
    } catch (error) {
      console.error('Error fetching advanced settings:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('bland-integration', {
        body: {
          action: 'update-advanced-settings',
          integration_id: integrationId,
          settings: {
            interruption_threshold: settings.interruption_threshold,
            voicemail_detection: settings.voicemail_detection,
            silence_timeout: settings.silence_timeout,
            max_call_duration: settings.max_call_duration,
            transfer_settings: {
              phone_number: settings.transfer_phone_number,
            },
            custom_greeting: settings.custom_greeting,
            hold_music_url: settings.hold_music_url,
            time_based_rules: settings.time_based_rules,
            a_b_test_config: settings.a_b_test_config,
            analytics_config: settings.analytics_config,
          }
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Settings Updated",
          description: "Advanced Bland AI settings have been saved successfully.",
        });
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        title: "Error",
        description: "Failed to update advanced settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Advanced Bland AI Settings
        </CardTitle>
        <CardDescription>
          Configure advanced features for enhanced call management and customization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="call-settings" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="call-settings">Call Settings</TabsTrigger>
            <TabsTrigger value="customization">Customization</TabsTrigger>
            <TabsTrigger value="time-rules">Time Rules</TabsTrigger>
            <TabsTrigger value="testing">A/B Testing</TabsTrigger>
          </TabsList>

          <TabsContent value="call-settings" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Interruption Threshold (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.interruption_threshold}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    interruption_threshold: parseInt(e.target.value) 
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Silence Timeout (seconds)</Label>
                <Input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.silence_timeout}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    silence_timeout: parseInt(e.target.value) 
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Max Call Duration (seconds)</Label>
                <Input
                  type="number"
                  min="60"
                  max="3600"
                  value={settings.max_call_duration}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    max_call_duration: parseInt(e.target.value) 
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Transfer Phone Number</Label>
                <Input
                  type="tel"
                  placeholder="+1234567890"
                  value={settings.transfer_phone_number}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    transfer_phone_number: e.target.value 
                  }))}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={settings.voicemail_detection}
                onCheckedChange={(checked) => setSettings(prev => ({ 
                  ...prev, 
                  voicemail_detection: checked 
                }))}
              />
              <Label>Enable Voicemail Detection</Label>
            </div>
          </TabsContent>

          <TabsContent value="customization" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Custom Greeting Message</Label>
                <Textarea
                  placeholder="Enter a custom greeting message for calls..."
                  value={settings.custom_greeting}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    custom_greeting: e.target.value 
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Hold Music URL</Label>
                <Input
                  type="url"
                  placeholder="https://example.com/music.mp3"
                  value={settings.hold_music_url}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    hold_music_url: e.target.value 
                  }))}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="time-rules" className="space-y-4">
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Time-Based Rules</h3>
              <p className="text-muted-foreground">
                Configure different behaviors based on time of day, day of week, or business hours.
              </p>
              <Button variant="outline" className="mt-4">
                Configure Time Rules
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="testing" className="space-y-4">
            <div className="text-center py-8">
              <TestTube className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">A/B Testing</h3>
              <p className="text-muted-foreground">
                Test different voice configurations, prompts, and call flows to optimize performance.
              </p>
              <Button variant="outline" className="mt-4">
                Setup A/B Tests
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};