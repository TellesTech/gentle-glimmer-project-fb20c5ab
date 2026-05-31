import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { User, Session } from '@/lib/supabaseAuth';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'super_admin' | 'admin' | 'collaborator';

interface Profile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  company_id?: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    role: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Guard against duplicate profile fetches
  const fetchingRef = useRef<string | null>(null);

  const fetchProfile = async (userId: string) => {
    // Prevent concurrent fetches for the same user
    if (fetchingRef.current === userId) return { profile: null, role: null };
    fetchingRef.current = userId;

    try {
      const [profileResult, roleResult] = await Promise.allSettled([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      ]);

      const profile = profileResult.status === 'fulfilled' ? profileResult.value.data as Profile | null : null;
      const role = roleResult.status === 'fulfilled' ? (roleResult.value.data?.role as UserRole | null) : null;

      return { profile, role };
    } catch (error) {
      console.warn('Profile fetch failed (non-fatal):', error);
      return { profile: null, role: null };
    } finally {
      fetchingRef.current = null;
    }
  };

  const refreshProfile = useCallback(async () => {
    if (state.user) {
      const { profile, role } = await fetchProfile(state.user.id);
      setState(prev => ({ ...prev, profile, role }));
    }
  }, [state.user]);

  useEffect(() => {
    let initialSessionHandled = false;

    const { data: { subscription } } = (supabase as any).auth.onAuthStateChange(
      (event: string, session: Session | null) => {
        // Skip if this is the initial session that getSession already handled
        if (!initialSessionHandled && event === 'INITIAL_SESSION') {
          return;
        }

        setState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
          isAuthenticated: !!session?.user,
          isLoading: false,
        }));

        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id).then(({ profile, role }) => {
              setState(prev => ({ ...prev, profile, role }));
            });
          }, 0);
        } else {
          setState(prev => ({ ...prev, profile: null, role: null }));
        }
      }
    );

    // Check for existing session once
    (supabase as any).auth.getSession().then(({ data: { session } }: any) => {
      initialSessionHandled = true;

      setState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
        isAuthenticated: !!session?.user,
        isLoading: false,
      }));

      if (session?.user) {
        fetchProfile(session.user.id).then(({ profile, role }) => {
          setState(prev => ({ ...prev, profile, role }));
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    const { error } = await (supabase as any).auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: error.message };
    }
    
    return { success: true };
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await (supabase as any).auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name,
        },
      },
    });
    
    if (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: error.message };
    }
    
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    await (supabase as any).auth.signOut();
    setState({
      user: null,
      session: null,
      profile: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, signup, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
