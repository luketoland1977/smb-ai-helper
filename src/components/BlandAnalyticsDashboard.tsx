import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, TrendingUp, Clock, Phone, DollarSign, Users } from "lucide-react";

interface AnalyticsData {
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  average_duration: number;
  total_cost: number;
  conversion_rate: number;
  peak_hours: string[];
  call_outcomes: { [key: string]: number };
}

interface BlandAnalyticsDashboardProps {
  integrationId: string;
}

export const BlandAnalyticsDashboard = ({ integrationId }: BlandAnalyticsDashboardProps) => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalytics();
  }, [integrationId]);

  const fetchAnalytics = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('bland-integration', {
        body: {
          action: 'get-analytics',
          integration_id: integrationId,
        }
      });

      if (error) throw error;

      if (data?.success) {
        // Mock analytics data for now since Bland AI API structure may vary
        const mockAnalytics: AnalyticsData = {
          total_calls: data.analytics?.total_calls || 0,
          successful_calls: data.analytics?.successful_calls || 0,
          failed_calls: data.analytics?.failed_calls || 0,
          average_duration: data.analytics?.average_duration || 0,
          total_cost: data.analytics?.total_cost || 0,
          conversion_rate: data.analytics?.conversion_rate || 0,
          peak_hours: data.analytics?.peak_hours || [],
          call_outcomes: data.analytics?.call_outcomes || {},
        };
        setAnalytics(mockAnalytics);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading analytics...</div>;
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Analytics Data</h3>
          <p className="text-muted-foreground">
            Analytics will appear here once you start making calls
          </p>
        </CardContent>
      </Card>
    );
  }

  const successRate = analytics.total_calls > 0 
    ? (analytics.successful_calls / analytics.total_calls * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analytics Dashboard
          </CardTitle>
          <CardDescription>
            Performance insights and call analytics for your Bland AI integration
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total_calls}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.successful_calls} successful, {analytics.failed_calls} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate}%</div>
            <p className="text-xs text-muted-foreground">
              Call completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.floor(analytics.average_duration / 60)}:{(analytics.average_duration % 60).toString().padStart(2, '0')}
            </div>
            <p className="text-xs text-muted-foreground">
              Minutes:seconds per call
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analytics.total_cost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Total spend on calls
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.conversion_rate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Goal achievement rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {analytics.peak_hours.length > 0 ? analytics.peak_hours.join(', ') : 'No data'}
            </div>
            <p className="text-xs text-muted-foreground">
              Most active calling hours
            </p>
          </CardContent>
        </Card>
      </div>

      {Object.keys(analytics.call_outcomes).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Call Outcomes</CardTitle>
            <CardDescription>
              Breakdown of call results and outcomes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(analytics.call_outcomes).map(([outcome, count]) => (
                <div key={outcome} className="flex justify-between items-center">
                  <span className="text-sm capitalize">{outcome.replace('_', ' ')}</span>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={fetchAnalytics} variant="outline">
          Refresh Analytics
        </Button>
      </div>
    </div>
  );
};