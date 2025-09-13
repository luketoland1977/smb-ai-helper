import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, Trash2 } from 'lucide-react';

const ClientForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    subdomain: ''
  });

  const isEditing = Boolean(id);

  useEffect(() => {
    if (isEditing) {
      loadClient();
    }
  }, [id, isEditing]);

  const loadClient = async () => {
    if (!id) return;
    
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load client data",
        variant: "destructive",
      });
      navigate('/dashboard');
      return;
    }

    if (data) {
      setFormData({
        name: data.name,
        domain: data.domain || '',
        subdomain: data.subdomain || ''
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {

      if (isEditing) {
        // Update existing client
        const { error } = await supabase
          .from('clients')
          .update(formData)
          .eq('id', id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Client updated successfully",
        });
      } else {
        // Create new client
        const { data: client, error: clientError } = await supabase
          .from('clients')
          .insert([formData])
          .select()
          .single();

        if (clientError) throw clientError;

        toast({
          title: "Success",
          description: "Client created successfully",
        });
      }

      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error saving client:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save client",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    
    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client deleted successfully",
      });

      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error deleting client:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete client",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button
              variant="ghost"
              onClick={() => navigate('/dashboard')}
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-xl font-semibold text-foreground">
              {isEditing ? 'Edit Client' : 'Create New Client'}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{isEditing ? 'Edit Client' : 'Create New Client'}</CardTitle>
            <CardDescription>
              {isEditing 
                ? 'Update your client organization details'
                : 'Add a new client organization to manage AI agents'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Client Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Acme Corporation"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="domain">Domain</Label>
                <Input
                  id="domain"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  placeholder="e.g., acmecorp.com"
                  type="url"
                />
                <p className="text-sm text-muted-foreground">
                  The primary domain where the AI agent will be deployed
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subdomain">Subdomain</Label>
                <Input
                  id="subdomain"
                  value={formData.subdomain}
                  onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
                  placeholder="e.g., support"
                />
                <p className="text-sm text-muted-foreground">
                  Custom subdomain for dedicated support portal (optional)
                </p>
              </div>

              <div className="flex justify-between">
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/dashboard')}
                    disabled={loading || deleteLoading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading || deleteLoading}>
                    {loading 
                      ? (isEditing ? 'Updating...' : 'Creating...') 
                      : (isEditing ? 'Update Client' : 'Create Client')
                    }
                  </Button>
                </div>

                {isEditing && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        type="button" 
                        variant="destructive"
                        disabled={loading || deleteLoading}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Client
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Client</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{formData.name}"? This will also delete all associated AI agents, chat sessions, and data. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          disabled={deleteLoading}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deleteLoading ? 'Deleting...' : 'Delete Client'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ClientForm;