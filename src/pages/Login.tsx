import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, ArrowRight, Eye, EyeOff, ArrowLeft, User, WifiOff, ExternalLink } from 'lucide-react';
import { loginSchema, validateForm } from '@/lib/validationSchemas';
import { SystemLogo } from '@/components/shared/SystemLogo';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { supabase } from '@/integrations/supabase/client';
import { validatePinWithRetry, isValidatePinFailure } from '@/lib/validatePin';
import { useQuery } from '@tanstack/react-query';
import { useLoginStats } from '@/hooks/useLoginStats';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { cn } from '@/lib/utils';

type LoginMode = 'quick' | 'pin' | 'email';

/** Read same-origin `?next=` and return a relative path, or null if unsafe/absent. */
function getSafeNextParam(): string | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('next');
    if (!raw) return null;
    // Must be a same-origin relative path.
    if (!raw.startsWith('/') || raw.startsWith('//')) return null;
    return raw;
  } catch {
    return null;
  }
}

interface QuickAccessUser {
  id: string;
  name: string;
  avatar_url: string | null;
  has_pin: boolean;
}

function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('Load failed') ||
    msg.includes('timeout') ||
    msg.includes('522') ||
    msg.includes('ECONNREFUSED')
  );
}

/** Centralized post-login resolver: queries profile/role once and navigates */
async function resolvePostLoginDestination(
  userId: string,
  navigate: (path: string) => void,
  onError: (err: unknown) => void,
) {
  try {
    // Run both queries in parallel using Promise.allSettled for resilience
    const [profileResult, clientResult] = await Promise.allSettled([
      supabase.from('profiles').select('id').eq('id', userId).maybeSingle(),
      supabase.from('client_profiles').select('id').eq('user_id', userId).maybeSingle(),
    ]);

    const profileData = profileResult.status === 'fulfilled' ? profileResult.value.data : null;
    const clientData = clientResult.status === 'fulfilled' ? clientResult.value.data : null;

    if (profileData) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleData?.role === 'admin' || roleData?.role === 'super_admin') {
        navigate('/super-admin');
      } else {
        navigate('/home');
      }
      return true;
    }

    if (clientData) {
      navigate('/client/dashboard');
      return true;
    }

    return false;
  } catch (err) {
    onError(err);
    return false;
  }
}

export default function Login() {
  const [loginMode, setLoginMode] = useState<LoginMode>('quick');
  const [isLoginInProgress, setIsLoginInProgress] = useState(false);
  const [selectedUser, setSelectedUser] = useState<QuickAccessUser | null>(null);
  const [pin, setPin] = useState('');
  const autoSubmittedPinRef = useRef<string>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings } = useSystemSettings();
  const { data: stats, isLoading: statsLoading } = useLoginStats();

  const getDisplayName = (fullName: string | null) => {
    if (!fullName) return '';
    const parts = fullName.split(' ');
    const prepositions = ['de', 'da', 'do', 'dos', 'das'];
    if (parts.length === 1) return parts[0];
    if (parts.length >= 3 && prepositions.includes(parts[1].toLowerCase())) {
      return parts.slice(0, 3).join(' ');
    }
    return parts.slice(0, 2).join(' ');
  };

  const { data: quickAccessUsers = [], isError: quickAccessError } = useQuery({
    queryKey: ['quick-access-users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_quick_access_users');
      if (error) throw error;
      return (data || []) as QuickAccessUser[];
    },
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // If quick access failed (backend down), default to email mode
  useEffect(() => {
    if (quickAccessError && loginMode === 'quick') {
      setLoginMode('email');
    }
  }, [quickAccessError, loginMode]);

  // Auto-redirect if already authenticated (non-login-in-progress)
  useEffect(() => {
    if (!isAuthenticated || isLoginInProgress) return;

    const doRedirect = async () => {
      try {
        const { data: { user } } = await (supabase as any).auth.getUser();
        if (!user) return;
        const next = getSafeNextParam();
        if (next) {
          navigate(next);
          return;
        }
        await resolvePostLoginDestination(user.id, navigate, () => {
          console.warn('Auto-redirect check failed — staying on login');
        });
      } catch {
        // Stay on login silently
      }
    };

    doRedirect();
  }, [isAuthenticated, isLoginInProgress, navigate]);

  const handleSelectUser = (user: QuickAccessUser) => {
    setSelectedUser(user);
    setPin('');
    autoSubmittedPinRef.current = '';
    setLoginMode('pin');
  };

  // Auto-submit PIN when 4 digits are entered
  useEffect(() => {
    if (
      loginMode === 'pin' &&
      pin.length === 4 &&
      !isLoading &&
      autoSubmittedPinRef.current !== pin
    ) {
      autoSubmittedPinRef.current = pin;
      handlePinLogin();
    }
  }, [pin, loginMode, isLoading]);

  const handlePinLogin = async () => {
    if (!selectedUser || pin.length !== 4) return;

    setIsLoading(true);
    setIsLoginInProgress(true);
    try {
      const data = await validatePinWithRetry({ userId: selectedUser.id, pin });

      if (isValidatePinFailure(data)) {
        toast({
          title: data.retryable ? 'Sistema indisponível' : 'PIN incorreto',
          description: data.error || (data.retryable
            ? 'O servidor está temporariamente fora do ar. Tente novamente em alguns minutos.'
            : 'Verifique o PIN e tente novamente.'),
          variant: 'destructive',
        });
        setPin('');
        setIsLoading(false);
        setIsLoginInProgress(false);
        return;
      }

      const { error: signInError } = await (supabase as any).auth.verifyOtp({
        token_hash: data.token_hash,
        type: 'magiclink',
      });

      if (signInError) {
        console.error('Sign in error:', signInError);
        toast({
          title: 'Erro no login',
          description: 'Não foi possível autenticar. Tente novamente.',
          variant: 'destructive',
        });
        setIsLoading(false);
        setIsLoginInProgress(false);
        return;
      }

      toast({
        title: 'Bem-vindo!',
        description: `Olá, ${selectedUser.name.split(' ')[0]}!`,
      });

      const nextPin = getSafeNextParam();
      if (nextPin) {
        navigate(nextPin);
        return;
      }

      // Use centralized resolver
      const resolved = await resolvePostLoginDestination(selectedUser.id, navigate, () => {});
      if (!resolved) navigate('/home');
    } catch (error) {
      console.error('PIN login error:', error);
      toast({
        title: isNetworkError(error) ? 'Sistema indisponível' : 'Erro no login',
        description: isNetworkError(error)
          ? 'O servidor está temporariamente fora do ar. Tente novamente em alguns minutos.'
          : 'Ocorreu um erro. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsLoginInProgress(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = validateForm(loginSchema, { email, password });

    if (validation.success === false) {
      setErrors(validation.errors);
      const firstError = Object.values(validation.errors)[0] as string;
      toast({
        title: 'Campos inválidos',
        description: firstError || 'Por favor, corrija os campos.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setIsLoginInProgress(true);

    try {
      const { data: authData, error: authError } = await (supabase as any).auth.signInWithPassword({
        email: validation.data.email,
        password: validation.data.password,
      });

      if (authError) {
        toast({
          title: isNetworkError(authError) ? 'Sistema indisponível' : 'Erro no login',
          description: isNetworkError(authError)
            ? 'O servidor está temporariamente fora do ar. Tente novamente em alguns minutos.'
            : 'Email ou senha incorretos. Tente novamente.',
          variant: 'destructive',
        });
        setIsLoading(false);
        setIsLoginInProgress(false);
        return;
      }

      const userId = authData.user?.id;

      if (!userId) {
        toast({
          title: 'Erro no login',
          description: 'Não foi possível identificar o usuário.',
          variant: 'destructive',
        });
        setIsLoading(false);
        setIsLoginInProgress(false);
        return;
      }

      toast({
        title: 'Bem-vindo!',
        description: 'Login realizado com sucesso.',
      });

      const nextEmail = getSafeNextParam();
      if (nextEmail) {
        navigate(nextEmail);
        return;
      }

      // Use centralized resolver
      const resolved = await resolvePostLoginDestination(userId, navigate, (err) => {
        console.warn('Post-login routing failed:', err);
      });

      if (!resolved) {
        // If we couldn't determine the profile type, try /home as a safe fallback
        // rather than signing out and losing the session
        toast({
          title: 'Aviso',
          description: 'Não foi possível determinar seu perfil. Redirecionando...',
        });
        navigate('/home');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: isNetworkError(error) ? 'Sistema indisponível' : 'Erro no login',
        description: isNetworkError(error)
          ? 'O servidor está temporariamente fora do ar. Tente novamente em alguns minutos.'
          : 'Ocorreu um erro. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsLoginInProgress(false);
    }
  };

  const handleBackToQuick = () => {
    setLoginMode('quick');
    setSelectedUser(null);
    setPin('');
    autoSubmittedPinRef.current = '';
  };

  return (
    <div className="min-h-screen lg:h-screen flex flex-col lg:flex-row overflow-hidden">
      {/* Left Panel — Gradient with curved edge */}
      <div
        className={cn(
          "hidden lg:flex lg:w-[48%] relative flex-col justify-center px-10 py-6 overflow-hidden",
          "animate-[slideInFromLeft_0.7s_cubic-bezier(0.16,1,0.3,1)_forwards]"
        )}
        style={{
          background: 'linear-gradient(160deg, #7A1B1B 0%, #A31D1D 50%, #8B0000 100%)',
        }}
      >
        {/* Straight right edge divider */}
        <div className="absolute top-0 right-0 h-full w-4 z-20 pointer-events-none bg-background" />

        {/* Background blurred shapes */}
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none">
          <div className="absolute top-16 left-8 w-56 h-56 rounded-full bg-white blur-3xl animate-float" />
          <div className="absolute bottom-24 right-28 w-72 h-72 rounded-full bg-white blur-3xl animate-float-delayed" />
          <div className="absolute top-1/2 left-1/3 w-40 h-40 rounded-full bg-white blur-3xl animate-float-slow" />
        </div>

        {/* Logo */}
        <div className="absolute top-6 left-10 z-10 animate-[fadeUp_0.6s_ease-out_0.2s_both]">
          {(settings?.login_logo_url || settings?.logo_url) ? (
            <img src={settings?.login_logo_url || settings?.logo_url || ''} alt={settings?.system_name || 'Sistema'} className="h-12 object-contain" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-primary-foreground/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <span className="text-2xl font-bold text-primary-foreground">
                  {(settings?.system_name || 'RDO').charAt(0)}
                </span>
              </div>
              <div>
                <span className="text-3xl font-bold text-primary-foreground">{settings?.system_name || 'Sistema RDO'}</span>
                <p className="text-base text-primary-foreground/70">{settings?.system_subtitle || 'Gestão de Atividades'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Center content — title + stats below */}
        <div className="relative z-10 space-y-4 animate-[fadeUp_0.6s_ease-out_0.4s_both]">
          <div className="space-y-2">
            <h1 className="text-3xl xl:text-4xl font-bold text-primary-foreground leading-[1.1] tracking-tight" style={{ textWrap: 'balance' as any }}>
              Gestão inteligente de relatórios de atividades
            </h1>
            <p className="text-lg text-primary-foreground/75 max-w-sm leading-relaxed">
              Organize, rastreie e aprove relatórios diários com segurança e praticidade.
            </p>
          </div>

          {/* Stats — below the subtitle, gracefully hidden when unavailable */}
          {(stats?.totalReports || stats?.totalProjects || stats?.totalCompaniesSites || statsLoading) && (
            <div className="flex gap-5">
              <div className="flex flex-col">
                <span className="text-2xl xl:text-3xl font-bold text-primary-foreground tabular-nums">
                  {statsLoading ? '...' : `${stats?.totalReports || 0}+`}
                </span>
                <span className="text-primary-foreground/60 text-xs uppercase tracking-wider">Relatórios</span>
              </div>
              <div className="w-px bg-primary-foreground/20" />
              <div className="flex flex-col">
                <span className="text-2xl xl:text-3xl font-bold text-primary-foreground tabular-nums">
                  {statsLoading ? '...' : stats?.totalProjects || 0}
                </span>
                <span className="text-primary-foreground/60 text-xs uppercase tracking-wider">Atividades</span>
              </div>
              <div className="w-px bg-primary-foreground/20" />
              <div className="flex flex-col">
                <span className="text-2xl xl:text-3xl font-bold text-primary-foreground tabular-nums">
                  {statsLoading ? '...' : stats?.totalCompaniesSites || 0}
                </span>
                <span className="text-primary-foreground/60 text-xs uppercase tracking-wider">Unidades</span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8 py-8 bg-background overflow-y-auto">
        <div className="w-full max-w-md space-y-4 animate-[fadeUp_0.5s_ease-out_0.3s_both]">
          {/* Mobile Logo */}
          <div className="lg:hidden animate-[fadeUp_0.4s_ease-out_both]">
            <SystemLogo size="md" />
          </div>

          {/* Backend unavailable banner */}
          {quickAccessError && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200 animate-[fadeUp_0.3s_ease-out_both]">
              <WifiOff className="h-5 w-5 shrink-0" />
              <p className="text-sm">
                Conexão instável com o servidor. Você ainda pode tentar entrar com email e senha.
              </p>
            </div>
          )}

          <Card className="border-0 shadow-lg animate-[scaleIn_0.4s_ease-out_both]">
            {/* Quick Access Mode */}
            {loginMode === 'quick' && (
              <>
                 <CardHeader className="space-y-1 pb-2 pt-4">
                   <CardTitle className="text-xl font-bold">Acesso Rápido</CardTitle>
                  <CardDescription>
                    {quickAccessUsers.length > 0 
                      ? 'Clique no seu perfil e insira o PIN de 4 dígitos para entrar'
                      : 'Nenhum usuário com PIN configurado'
                    }
                  </CardDescription>
                </CardHeader>
                
                 <CardContent className="space-y-3 pb-3">
                  {quickAccessUsers.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2 max-h-[420px] overflow-y-auto pr-1">
                      {quickAccessUsers.map((user, i) => (
                        <button
                          key={user.id}
                          onClick={() => handleSelectUser(user)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all hover:bg-muted",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            "active:scale-[0.96]"
                          )}
                          style={{ animationDelay: `${i * 80 + 200}ms` }}
                        >
                          <Avatar className="h-11 w-11 border-2 border-transparent hover:border-primary transition-colors">
                            <AvatarImage src={user.avatar_url || ''} alt={user.name} />
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                              {user.name?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-center font-medium leading-tight whitespace-normal">
                            {getDisplayName(user.name)}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 py-8 text-muted-foreground">
                      <User className="h-12 w-12" />
                      <p className="text-sm text-center">
                        Nenhum PIN cadastrado. Peça ao administrador para configurar seu PIN de 4 dígitos na página de Usuários.
                      </p>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 w-full text-sm text-muted-foreground">
                    <div className="flex-1 h-px bg-border" />
                    <span>ou</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full active:scale-[0.97]"
                    onClick={() => setLoginMode('email')}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Prefere usar email e senha? Clique aqui
                  </Button>
                </CardFooter>
              </>
            )}

            {/* PIN Entry Mode */}
            {loginMode === 'pin' && selectedUser && (
              <>
                <CardHeader className="space-y-1 pb-4">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-fit -ml-2"
                    onClick={handleBackToQuick}
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Voltar
                  </Button>
                </CardHeader>
                
                 <CardContent className="space-y-4">
                   <div className="flex flex-col items-center gap-2">
                     <Avatar className="h-16 w-16 border-4 border-primary/20">
                       <AvatarImage src={selectedUser.avatar_url || ''} alt={selectedUser.name} />
                       <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                         {selectedUser.name?.substring(0, 2).toUpperCase()}
                       </AvatarFallback>
                     </Avatar>
                     <p className="font-semibold text-base">{selectedUser.name}</p>
                  </div>

                  <div className="space-y-3">
                    <p className="text-center text-sm text-muted-foreground">
                      Insira abaixo o PIN de 4 dígitos fornecido pelo administrador
                    </p>
                    
                    <div className="flex justify-center">
                      <InputOTP 
                        maxLength={4} 
                        value={pin} 
                        onChange={setPin}
                        disabled={isLoading}
                      >
                        <InputOTPGroup>
                           <InputOTPSlot index={0} className="w-12 h-12 text-lg" />
                           <InputOTPSlot index={1} className="w-12 h-12 text-lg" />
                           <InputOTPSlot index={2} className="w-12 h-12 text-lg" />
                           <InputOTPSlot index={3} className="w-12 h-12 text-lg" />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-3">
                  <div className="w-full flex items-center justify-center min-h-[40px] text-sm text-muted-foreground">
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Validando...
                      </span>
                    ) : (
                      <span>Digite os 4 dígitos para entrar</span>
                    )}
                  </div>
                </CardFooter>
              </>
            )}

            {/* Traditional Email/Password Mode */}
            {loginMode === 'email' && (
              <>
                <CardHeader className="space-y-1 pb-4">
                  {quickAccessUsers.length > 0 && !quickAccessError && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-fit -ml-2"
                      onClick={handleBackToQuick}
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Acesso rápido
                    </Button>
                  )}
                  <CardTitle className="text-2xl font-bold">Entrar</CardTitle>
                  <CardDescription>
                    Acesse sua conta para gerenciar relatórios
                  </CardDescription>
                </CardHeader>
                
                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 animate-[fadeUp_0.4s_ease-out_0.1s_both]">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="seu@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2 animate-[fadeUp_0.4s_ease-out_0.2s_both]">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Senha</Label>
                        <Link 
                          to="/forgot-password" 
                          className="text-sm text-primary hover:underline"
                        >
                          Esqueceu a senha?
                        </Link>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10"
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter>
                    <Button 
                      type="submit" 
                      className="w-full gap-2 active:scale-[0.97]" 
                      size="lg"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Entrando...
                        </>
                      ) : (
                        <>
                          Entrar
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
