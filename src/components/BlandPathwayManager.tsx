import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { GitBranch, Plus, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Pathway {
  id: string;
  name: string;
  description: string;
  pathway_config: any;
  is_active: boolean;
  created_at: string;
}

interface BlandPathwayManagerProps {
  integrationId: string;
  clientId: string;
}

export const BlandPathwayManager = ({ integrationId, clientId }: BlandPathwayManagerProps) => {
  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    pathway_config: '{\n  "nodes": [],\n  "edges": [],\n  "entry_point": "welcome"\n}',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchPathways();
  }, [integrationId]);

  const fetchPathways = async () => {
    try {
      const { data, error } = await supabase
        .from('bland_pathways')
        .select('*')
        .eq('integration_id', integrationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPathways(data || []);
    } catch (error) {
      console.error('Error fetching pathways:', error);
      toast({
        title: "Error",
        description: "Failed to load pathways.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createPathway = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Please enter a pathway name.",
        variant: "destructive",
      });
      return;
    }

    try {
      let pathwayConfig;
      try {
        pathwayConfig = JSON.parse(formData.pathway_config);
      } catch {
        throw new Error('Invalid JSON in pathway configuration');
      }

      const { data, error } = await supabase.functions.invoke('bland-integration', {
        body: {
          action: 'create-pathway',
          client_id: clientId,
          integration_id: integrationId,
          name: formData.name,
          description: formData.description,
          pathway_config: pathwayConfig,
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Pathway Created",
          description: "Conversation pathway has been created successfully.",
        });
        setFormData({
          name: '',
          description: '',
          pathway_config: '{\n  "nodes": [],\n  "edges": [],\n  "entry_point": "welcome"\n}',
        });
        fetchPathways();
      }
    } catch (error) {
      console.error('Error creating pathway:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create pathway. Please try again.",
        variant: "destructive",
      });
    }
  };

  const deletePathway = async (pathwayId: string) => {
    try {
      const { error } = await supabase
        .from('bland_pathways')
        .delete()
        .eq('id', pathwayId);

      if (error) throw error;

      toast({
        title: "Pathway Deleted",
        description: "Conversation pathway has been removed.",
      });
      fetchPathways();
    } catch (error) {
      console.error('Error deleting pathway:', error);
      toast({
        title: "Error",
        description: "Failed to delete pathway. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading pathways...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Conversation Pathways
          </CardTitle>
          <CardDescription>
            Create custom conversation flows and decision trees for your Bland AI agent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Create New Pathway
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Conversation Pathway</DialogTitle>
                <DialogDescription>
                  Design a custom conversation flow for specific scenarios
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Pathway Name</Label>
                  <Input
                    placeholder="e.g., Customer Support Flow"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Describe when and how this pathway should be used..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Pathway Configuration (JSON)</Label>
                  <Textarea
                    className="font-mono text-sm"
                    rows={8}
                    placeholder="Enter pathway configuration in JSON format..."
                    value={formData.pathway_config}
                    onChange={(e) => setFormData(prev => ({ ...prev, pathway_config: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Define nodes, edges, and decision points for the conversation flow
                  </p>
                </div>

                <Button onClick={createPathway} className="w-full">
                  Create Pathway
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {pathways.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Pathways Created</h3>
            <p className="text-muted-foreground">
              Create your first conversation pathway to guide AI interactions
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pathways.map((pathway) => (
            <Card key={pathway.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{pathway.name}</CardTitle>
                    <Badge variant={pathway.is_active ? "default" : "secondary"}>
                      {pathway.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => deletePathway(pathway.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {pathway.description && (
                  <CardDescription>{pathway.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Created on {new Date(pathway.created_at).toLocaleDateString()}
                </div>
                <div className="mt-2">
                  <details className="text-sm">
                    <summary className="cursor-pointer text-primary">View Configuration</summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                      {JSON.stringify(pathway.pathway_config, null, 2)}
                    </pre>
                  </details>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};