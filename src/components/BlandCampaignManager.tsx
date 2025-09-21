import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Plus, Play, Pause, BarChart3, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Campaign {
  id: string;
  name: string;
  description: string;
  target_phone_numbers: string[];
  campaign_config: any;
  schedule_config: any;
  status: string;
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  created_at: string;
}

interface BlandCampaignManagerProps {
  integrationId: string;
  clientId: string;
}

export const BlandCampaignManager = ({ integrationId, clientId }: BlandCampaignManagerProps) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target_phone_numbers: '',
    campaign_config: '{\n  "message": "Hello, this is an automated call.",\n  "max_retries": 3,\n  "retry_delay": 3600\n}',
    schedule_config: '{\n  "start_time": "09:00",\n  "end_time": "17:00",\n  "timezone": "America/New_York",\n  "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]\n}',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchCampaigns();
  }, [integrationId]);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('bland_campaigns')
        .select('*')
        .eq('integration_id', integrationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast({
        title: "Error",
        description: "Failed to load campaigns.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createCampaign = async () => {
    if (!formData.name.trim() || !formData.target_phone_numbers.trim()) {
      toast({
        title: "Error",
        description: "Please enter campaign name and phone numbers.",
        variant: "destructive",
      });
      return;
    }

    try {
      let campaignConfig, scheduleConfig;
      try {
        campaignConfig = JSON.parse(formData.campaign_config);
        scheduleConfig = JSON.parse(formData.schedule_config);
      } catch {
        throw new Error('Invalid JSON in configuration');
      }

      const phoneNumbers = formData.target_phone_numbers
        .split('\n')
        .map(num => num.trim())
        .filter(num => num.length > 0);

      const { data, error } = await supabase.functions.invoke('bland-integration', {
        body: {
          action: 'create-campaign',
          client_id: clientId,
          integration_id: integrationId,
          name: formData.name,
          description: formData.description,
          target_phone_numbers: phoneNumbers,
          campaign_config: campaignConfig,
          schedule_config: scheduleConfig,
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Campaign Created",
          description: "Outbound calling campaign has been created successfully.",
        });
        setFormData({
          name: '',
          description: '',
          target_phone_numbers: '',
          campaign_config: '{\n  "message": "Hello, this is an automated call.",\n  "max_retries": 3,\n  "retry_delay": 3600\n}',
          schedule_config: '{\n  "start_time": "09:00",\n  "end_time": "17:00",\n  "timezone": "America/New_York",\n  "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]\n}',
        });
        fetchCampaigns();
      }
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create campaign. Please try again.",
        variant: "destructive",
      });
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    try {
      const { error } = await supabase
        .from('bland_campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;

      toast({
        title: "Campaign Deleted",
        description: "Campaign has been removed.",
      });
      fetchCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast({
        title: "Error",
        description: "Failed to delete campaign. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'paused': return 'secondary';
      case 'completed': return 'outline';
      case 'draft': return 'secondary';
      default: return 'secondary';
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading campaigns...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Campaign Management
          </CardTitle>
          <CardDescription>
            Create and manage outbound calling campaigns with scheduling and automation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Create New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Outbound Campaign</DialogTitle>
                <DialogDescription>
                  Set up an automated calling campaign with scheduling and targeting
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Campaign Name</Label>
                    <Input
                      placeholder="e.g., Product Launch Outreach"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="Brief description of the campaign"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Target Phone Numbers</Label>
                  <Textarea
                    placeholder="Enter phone numbers, one per line:&#10;+1234567890&#10;+0987654321"
                    rows={6}
                    value={formData.target_phone_numbers}
                    onChange={(e) => setFormData(prev => ({ ...prev, target_phone_numbers: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter one phone number per line with country code
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Campaign Configuration</Label>
                    <Textarea
                      className="font-mono text-sm"
                      rows={6}
                      value={formData.campaign_config}
                      onChange={(e) => setFormData(prev => ({ ...prev, campaign_config: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Configure call behavior and retry logic
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Schedule Configuration</Label>
                    <Textarea
                      className="font-mono text-sm"
                      rows={6}
                      value={formData.schedule_config}
                      onChange={(e) => setFormData(prev => ({ ...prev, schedule_config: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Set calling hours and timezone
                    </p>
                  </div>
                </div>

                <Button onClick={createCampaign} className="w-full">
                  Create Campaign
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Campaigns Created</h3>
            <p className="text-muted-foreground">
              Create your first outbound calling campaign to reach customers at scale
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{campaign.name}</CardTitle>
                    <Badge variant={getStatusColor(campaign.status)}>
                      {campaign.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => deleteCampaign(campaign.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {campaign.description && (
                  <CardDescription>{campaign.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="font-medium">Targets</div>
                    <div className="text-muted-foreground">{campaign.target_phone_numbers.length}</div>
                  </div>
                  <div>
                    <div className="font-medium">Total Calls</div>
                    <div className="text-muted-foreground">{campaign.total_calls || 0}</div>
                  </div>
                  <div>
                    <div className="font-medium">Successful</div>
                    <div className="text-green-600">{campaign.successful_calls || 0}</div>
                  </div>
                  <div>
                    <div className="font-medium">Failed</div>
                    <div className="text-red-600">{campaign.failed_calls || 0}</div>
                  </div>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  Created on {new Date(campaign.created_at).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};