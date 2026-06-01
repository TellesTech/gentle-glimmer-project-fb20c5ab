import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/client/ClientLayout';
import { SignatureInput } from '@/components/client/SignatureInput';
import { 
  User, 
  Mail, 
  Building2, 
  Briefcase, 
  PenTool,
  Check,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/loose-client';
import { useNavigate } from 'react-router-dom';

export default function ClientProfile() {
  const { clientProfile, updateSignature, refreshProfile, isLoading: authLoading } = useClientAuth();
  const { role, profile: adminProfile, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isInternalUser = (role === 'admin' || role === 'super_admin' || role === 'collaborator') && !clientProfile;

  // Fetch full admin profile data (with signature_data & job_title)
  const [adminFullProfile, setAdminFullProfile] = useState<{
    name: string; email: string; job_title: string | null; signature_data: string | null;
  } | null>(null);

  useEffect(() => {
    if (isInternalUser && user?.id) {
      supabase.from('profiles').select('name, email, job_title, signature_data').eq('id', user.id).single()
        .then(({ data }) => { if (data) setAdminFullProfile(data); });
    }
  }, [isInternalUser, user?.id]);

  const effectiveProfile = clientProfile || (isInternalUser && adminFullProfile ? {
    id: user!.id,
    name: adminFullProfile.name,
    email: adminFullProfile.email,
    company: '',
    role: adminFullProfile.job_title || '',
    signature_data: adminFullProfile.signature_data,
    is_active: true,
    can_approve: true,
    _source: 'profiles' as const,
  } : null);
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingSignature, setIsEditingSignature] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newSignature, setNewSignature] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    name: effectiveProfile?.name || '',
    company: (effectiveProfile as any)?.company || '',
    role: effectiveProfile?.role || '',
  });

  const handleProfileSave = async () => {
    if (!effectiveProfile) return;

    setIsSaving(true);
    try {
      if (isInternalUser) {
        // Save to profiles table for internal users
        const { error } = await supabase
          .from('profiles')
          .update({ name: formData.name, job_title: formData.role })
          .eq('id', effectiveProfile.id);
        if (error) throw error;
        // Refresh admin profile data
        const { data } = await supabase.from('profiles').select('name, email, job_title, signature_data').eq('id', effectiveProfile.id).single();
        if (data) setAdminFullProfile(data);
      } else {
        const table = clientProfile!._source === 'company_contacts' ? 'company_contacts' : 'client_profiles';
        const updateData: Record<string, any> = {
          name: formData.name,
          role: formData.role,
          updated_at: new Date().toISOString(),
        };
        if (table === 'client_profiles') {
          updateData.company = formData.company;
        }
        const { error } = await supabase
          .from(table)
          .update(updateData)
          .eq('id', clientProfile!.id);
        if (error) throw error;
        await refreshProfile();
      }
      setIsEditingProfile(false);
      toast({
        title: 'Perfil atualizado',
        description: 'Suas informações foram salvas com sucesso',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Ocorreu um erro ao atualizar seu perfil',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignatureSave = async () => {
    if (!newSignature) {
      toast({
        title: 'Assinatura vazia',
        description: 'Por favor, desenhe sua assinatura',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      if (isInternalUser) {
        // Save signature to profiles table
        const { error } = await supabase
          .from('profiles')
          .update({ signature_data: newSignature })
          .eq('id', effectiveProfile!.id);
        if (error) throw error;
        const { data } = await supabase.from('profiles').select('name, email, job_title, signature_data').eq('id', effectiveProfile!.id).single();
        if (data) setAdminFullProfile(data);
      } else {
        const { error } = await updateSignature(newSignature);
        if (error) throw error;
      }

      setIsEditingSignature(false);
      setNewSignature(null);
      toast({
        title: 'Assinatura atualizada',
        description: 'Sua assinatura foi salva com sucesso',
      });
    } catch (error) {
      console.error('Error updating signature:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Ocorreu um erro ao atualizar sua assinatura',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      toast({ title: 'Senha muito curta', description: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Senhas não coincidem', description: 'A confirmação de senha deve ser igual à nova senha', variant: 'destructive' });
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await (supabase as any).auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Senha alterada', description: 'Sua senha foi atualizada com sucesso' });
    } catch (error: any) {
      toast({ title: 'Erro ao alterar senha', description: error.message, variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
  };

  if (authLoading) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </ClientLayout>
    );
  }

  if (!effectiveProfile) {
    return (
      <ClientLayout>
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <AlertTriangle className="h-12 w-12 text-amber-500" />
          <h2 className="text-xl font-semibold">Perfil de cliente não encontrado</h2>
          <p className="text-muted-foreground text-center">Sua conta não possui um perfil de cliente vinculado.</p>
          <Button onClick={() => navigate('/login')}>Voltar ao login</Button>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="space-y-4 sm:space-y-6 max-w-full sm:max-w-2xl mx-auto min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl xs:text-2xl font-bold truncate">Meu Perfil</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie suas informações e assinatura digital
          </p>
        </div>

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Informações Pessoais
                </CardTitle>
                <CardDescription>
                  Seus dados de identificação
                </CardDescription>
              </div>
              {!isEditingProfile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFormData({
                      name: effectiveProfile.name,
                      company: effectiveProfile.company || '',
                      role: effectiveProfile.role || '',
                    });
                    setIsEditingProfile(true);
                  }}
                >
                  Editar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditingProfile ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">Empresa</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Cargo</Label>
                    <Input
                      id="role"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleProfileSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditingProfile(false)}
                    disabled={isSaving}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">Email:</span>
                  <span className="text-sm truncate">{effectiveProfile.email}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">Nome:</span>
                  <span className="text-sm truncate">{effectiveProfile.name}</span>
                </div>
                {effectiveProfile.company && (
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground">Empresa:</span>
                    <span className="text-sm truncate">{effectiveProfile.company}</span>
                  </div>
                )}
                {effectiveProfile.role && (
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground">Cargo:</span>
                    <span className="text-sm truncate">{effectiveProfile.role}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assinatura Digital */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <PenTool className="h-5 w-5 text-primary" />
                  Minha Assinatura Digital
                  {effectiveProfile.signature_data && (
                    <Badge variant="outline" className="text-success border-success ml-2">
                      <Check className="h-3 w-3 mr-1" />
                      Ativa
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {isInternalUser
                    ? 'Sua assinatura será usada no Portal do Cliente para aprovar relatórios com um clique'
                    : 'Sua assinatura digital para aprovar relatórios com um clique'}
                </CardDescription>
              </div>
              {!isEditingSignature && effectiveProfile.signature_data && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingSignature(true)}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Atualizar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditingSignature || !effectiveProfile.signature_data ? (
              <div className="space-y-4">
                <SignatureInput
                  onSignatureChange={setNewSignature}
                  disabled={isSaving}
                  initialSignature={effectiveProfile.signature_data || undefined}
                />
                <div className="flex gap-2">
                  <Button onClick={handleSignatureSave} disabled={isSaving || !newSignature}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar Assinatura
                  </Button>
                  {effectiveProfile.signature_data && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditingSignature(false);
                        setNewSignature(null);
                      }}
                      disabled={isSaving}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
              <div className="p-3 sm:p-4 border-2 border-dashed rounded-lg bg-muted/30">
                  <img
                    src={effectiveProfile.signature_data}
                    alt="Sua assinatura"
                    className="max-h-24 sm:max-h-32 mx-auto"
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Esta assinatura será usada automaticamente ao aprovar relatórios.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security - Password Change */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Segurança
            </CardTitle>
            <CardDescription>
              Altere sua senha de acesso por email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-10 w-10"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                />
              </div>
              <Button
                onClick={handlePasswordChange}
                disabled={changingPassword || !newPassword || !confirmPassword}
              >
                {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Alterar Senha
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status da Conta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <Badge 
                variant={effectiveProfile.is_active ? 'default' : 'secondary'}
                className={effectiveProfile.is_active ? 'bg-success' : ''}
              >
                {effectiveProfile.is_active ? 'Ativa' : 'Inativa'}
              </Badge>
              {effectiveProfile.can_approve && (
                <Badge variant="outline">
                  <PenTool className="h-3 w-3 mr-1" />
                  Pode Aprovar
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
}
