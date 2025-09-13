import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'salesperson' | 'support' | 'admin'>('salesperson');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const roleOptions = [
    { value: 'salesperson', label: 'Salesperson', description: 'Manage clients and agents' },
    { value: 'support', label: 'Support', description: 'Handle customer support and knowledge base' },
    { value: 'admin', label: 'Administrator', description: 'Full system access (requires approval)' }
  ] as const;

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Input validation
    if (!email || !email.includes('@')) {
      toast({
        title: "Error",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    
    if (!password || password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          requested_role: selectedRole
        }
      }
    });

    console.log('Signup response:', { data, error });

    if (error) {
      // Handle specific error types
      if (error.message.includes('already registered')) {
        toast({
          title: "Account exists",
          description: "This email is already registered. Please sign in instead.",
          variant: "destructive",
        });
      } else if (error.message.includes('password')) {
        toast({
          title: "Password error",
          description: "Password must be at least 6 characters long.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } else if (data.session) {
      // User is immediately signed in (email confirmation disabled)
      toast({
        title: "Success",
        description: selectedRole === 'admin' 
          ? "Account created! Admin access requires approval." 
          : "Account created successfully! Redirecting...",
      });
      navigate('/dashboard');
    } else if (data.user && !data.session) {
      // Email confirmation is enabled
      toast({
        title: "Account Created",
        description: "Please check your email for the confirmation link.",
        variant: "default",
      });
    } else {
      toast({
        title: "Success", 
        description: "Account created successfully!",
      });
    }
    
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Input validation
    if (!email || !email.includes('@')) {
      toast({
        title: "Error",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    
    if (!password) {
      toast({
        title: "Error",
        description: "Please enter your password.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Handle specific error types with better security messaging
      if (error.message.includes('Invalid login credentials')) {
        toast({
          title: "Login failed",
          description: "Invalid email or password. Please check your credentials.",
          variant: "destructive",
        });
      } else if (error.message.includes('Email not confirmed')) {
        toast({
          title: "Email not verified",
          description: "Please check your email and click the confirmation link.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Login failed. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Success",
        description: "Welcome back!",
      });
      navigate('/dashboard');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Admin Access</CardTitle>
          <CardDescription>
            Sign in to access the AI Service Pro admin dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-select">Role</Label>
                  <select 
                    id="role-select"
                    value={selectedRole} 
                    onChange={(e) => setSelectedRole(e.target.value as typeof selectedRole)}
                    className="w-full p-2 border border-input bg-background rounded-md text-sm"
                  >
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {roleOptions.find(r => r.value === selectedRole)?.description}
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;