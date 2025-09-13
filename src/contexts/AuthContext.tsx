import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'admin' | 'salesperson' | 'support' | 'viewer';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRoles: UserRole[];
  hasRole: (role: UserRole) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Fetch user roles when session changes
        if (session?.user) {
          setTimeout(async () => {
            try {
              console.log('🔍 Fetching roles for user:', session.user.id);
              const { data: roles, error } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id);
              
              console.log('📋 User roles response:', { roles, error });
              
              if (!error && roles) {
                const userRolesList = roles.map(r => r.role as UserRole);
                console.log('✅ Setting user roles:', userRolesList);
                setUserRoles(userRolesList);
              } else {
                console.error('❌ Error fetching user roles:', error);
                setUserRoles([]);
              }
            } catch (error) {
              console.error('💥 Exception fetching user roles:', error);
              setUserRoles([]);
            }
          }, 0);
        } else {
          console.log('👤 No user session, clearing roles');
          setUserRoles([]);
        }
        
        setLoading(false);
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Fetch initial roles
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .then(({ data: roles, error }) => {
            if (!error && roles) {
              setUserRoles(roles.map(r => r.role as UserRole));
            }
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const hasRole = (role: UserRole): boolean => {
    return userRoles.includes(role);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    loading,
    userRoles,
    hasRole,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};