import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, Session } from '@/lib/supabaseAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ClientProfile {
  id: string;
  email: string;
  name: string;
  company: string | null;
  role: string | null;
  signature_data: string | null;
  company_id: string | null;
  is_active: boolean;
  can_approve: boolean;
  _source?: 'client_profiles' | 'company_contacts';
}

interface ClientAuthContextType {
  user: User | null;
  session: Session | null;
  clientProfile: ClientProfile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string, company?: string, role?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateSignature: (signatureData: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export function ClientAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const fetchingRef = useRef<string | null>(null);

  const fetchClientProfile = async (userId: string) => {
    // Prevent concurrent fetches
    if (fetchingRef.current === userId) return null;
    fetchingRef.current = userId;

    try {
      const { data, error } = await supabase
        .from('client_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) console.error('Error fetching client profile:', error);
      if (data) return { ...data, _source: 'client_profiles' as const } as ClientProfile;

      // Fallback: search in company_contacts
      const { data: contact, error: contactError } = await supabase
        .from('company_contacts')
        .select('id, email, name, company_id, role, signature_data, is_active, can_approve')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (contactError) {
        console.error('Error fetching company contact:', contactError);
        return null;
      }

      if (contact) {
        return {
          id: contact.id,
          email: contact.email,
          name: contact.name,
          company: null,
          company_id: contact.company_id,
          role: contact.role,
          signature_data: contact.signature_data,
          is_active: contact.is_active ?? true,
          can_approve: contact.can_approve ?? false,
          _source: 'company_contacts' as const,
        } as ClientProfile;
      }

      return null;
    } catch {
      return null;
    } finally {
      fetchingRef.current = null;
    }
  };

  useEffect(() => {
    let initialSessionHandled = false;

    const { data: { subscription } } = (supabase as any).auth.onAuthStateChange(
      (event: string, session: Session | null) => {
        if (!initialSessionHandled && event === 'INITIAL_SESSION') return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            fetchClientProfile(session.user.id).then(setClientProfile);
          }, 0);
        } else {
          setClientProfile(null);
        }
      }
    );

    (supabase as any).auth.getSession().then(({ data: { session } }: any) => {
      initialSessionHandled = true;
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchClientProfile(session.user.id).then((profile) => {
          setClientProfile(profile);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await (supabase as any).auth.signInWithPassword({ email, password });
      return { error: error || null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (
    email: string, 
    password: string, 
    name: string, 
    company?: string, 
    role?: string
  ) => {
    try {
      const redirectUrl = `${window.location.origin}/client/dashboard`;

      const { data: authData, error: authError } = await (supabase as any).auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { name, is_client: true }
        }
      });

      if (authError) return { error: authError };

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('client_profiles')
          .insert({
            user_id: authData.user.id,
            email,
            name,
            company: company || null,
            role: role || null,
            is_active: true,
            can_approve: true,
          });

        if (profileError) {
          console.error('Error creating client profile:', profileError);
          return { error: profileError };
        }

        const { data: profile } = await supabase
          .from('client_profiles')
          .select('id')
          .eq('user_id', authData.user.id)
          .single();

        if (profile) {
          await supabase
            .from('client_user_roles')
            .insert({ client_id: profile.id, role: 'approver' });
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await (supabase as any).auth.signOut();
    setUser(null);
    setSession(null);
    setClientProfile(null);
  };

  const updateSignature = async (signatureData: string) => {
    if (!user || !clientProfile) {
      return { error: new Error('User not authenticated') };
    }

    const table = clientProfile._source === 'company_contacts' ? 'company_contacts' : 'client_profiles';

    const { error } = await supabase
      .from(table)
      .update({ signature_data: signatureData, updated_at: new Date().toISOString() })
      .eq('id', clientProfile.id);

    if (error) return { error };

    setClientProfile({ ...clientProfile, signature_data: signatureData });
    return { error: null };
  };

  const refreshProfile = async () => {
    if (user) {
      const profile = await fetchClientProfile(user.id);
      setClientProfile(profile);
    }
  };

  return (
    <ClientAuthContext.Provider
      value={{
        user, session, clientProfile, isLoading,
        signIn, signUp, signOut, updateSignature, refreshProfile,
      }}
    >
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth() {
  const context = useContext(ClientAuthContext);
  if (context === undefined) {
    throw new Error('useClientAuth must be used within a ClientAuthProvider');
  }
  return context;
}
