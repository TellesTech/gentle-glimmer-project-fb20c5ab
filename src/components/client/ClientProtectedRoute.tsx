import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ClientProtectedRouteProps {
  children: ReactNode;
}

export function ClientProtectedRoute({ children }: ClientProtectedRouteProps) {
  const { user, clientProfile, isLoading } = useClientAuth();
  const { role, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const isInternalUser = role === 'admin' || role === 'super_admin' || role === 'collaborator';

  useEffect(() => {
    if (!isLoading && !authLoading && !user) {
      navigate('/login');
    }
  }, [user, isLoading, authLoading, navigate]);

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Allow internal users (admin, super_admin, collaborator) through even without client profile
  if (!clientProfile && !isInternalUser) {
    return null;
  }

  return <>{children}</>;
}
