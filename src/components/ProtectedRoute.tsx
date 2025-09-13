import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: ('admin' | 'salesperson' | 'support' | 'viewer')[];
  fallbackPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  roles = [], 
  fallbackPath = '/auth' 
}) => {
  const { user, loading, hasRole, userRoles } = useAuth();
  const location = useLocation();

  // Debug logging
  console.log('🛡️ ProtectedRoute check:', {
    hasUser: !!user,
    loading,
    userRoles,
    requiredRoles: roles,
    currentPath: location.pathname
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    console.log('❌ No user, redirecting to auth');
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  if (roles.length > 0 && !roles.some(role => hasRole(role))) {
    console.log('❌ Access denied - Required roles:', roles, 'User roles:', userRoles);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
          <p className="text-xs text-muted-foreground mt-2">
            Required: {roles.join(', ')} | Your roles: {userRoles.join(', ') || 'none'}
          </p>
        </div>
      </div>
    );
  }

  console.log('✅ Access granted');
  return <>{children}</>;
};