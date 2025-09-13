import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface RoleRequest {
  id: string;
  user_id: string;
  requested_role: string;
  status: string;
  created_at: string;
  notes?: string;
  profiles: {
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

const RoleRequests = () => {
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchRoleRequests();
  }, []);

  const fetchRoleRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('role_requests')
        .select(`
          *,
          profiles:user_id (
            email,
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data as any) || []);
    } catch (error) {
      console.error('Error fetching role requests:', error);
      toast({
        title: "Error",
        description: "Failed to load role requests.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (requestId: string, userId: string, requestedRole: string, action: 'approve' | 'deny') => {
    try {
      if (action === 'approve') {
        // Update user role - first delete existing role
        const { error: deleteError } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId);

        if (deleteError) throw deleteError;

        // Insert new role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: requestedRole as any });

        if (roleError) throw roleError;
      }

      // Update request status
      const { error: requestError } = await supabase
        .from('role_requests')
        .update({
          status: action === 'approve' ? 'approved' : 'denied',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (requestError) throw requestError;

      toast({
        title: "Success",
        description: `Role request ${action}d successfully.`,
      });

      fetchRoleRequests();
    } catch (error) {
      console.error('Error handling request:', error);
      toast({
        title: "Error",
        description: `Failed to ${action} role request.`,
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'denied':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
      pending: 'default',
      approved: 'secondary', // Changed from 'success' which doesn't exist
      denied: 'destructive'
    };

    return (
      <Badge variant={variants[status] || 'default'}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Role Requests</h1>
        <p className="text-muted-foreground">
          Manage user role requests and approvals
        </p>
      </div>

      <div className="space-y-4">
        {requests.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                No role requests found.
              </p>
            </CardContent>
          </Card>
        ) : (
          requests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {request.profiles.first_name && request.profiles.last_name
                        ? `${request.profiles.first_name} ${request.profiles.last_name}`
                        : request.profiles.email}
                    </CardTitle>
                    <CardDescription>
                      {request.profiles.email} • Requested: {request.requested_role}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(request.status)}
                    {getStatusBadge(request.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Requested on: {new Date(request.created_at).toLocaleDateString()}
                  </div>
                  {request.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRequest(request.id, request.user_id, request.requested_role, 'deny')}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Deny
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleRequest(request.id, request.user_id, request.requested_role, 'approve')}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default RoleRequests;