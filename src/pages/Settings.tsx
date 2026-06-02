import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { RoleBadge } from '@/components/shared';
import type { UserRole } from '@/types';
import { ImageUploader } from '@/components/shared/ImageUploader';
import { AvatarUpload } from '@/components/shared/AvatarUpload';
import { ColorPicker } from '@/components/shared/ColorPicker';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { User, Shield, Info, Loader2, FileText, Palette, Image, Type, Building2, Settings2, Eye, EyeOff, Sparkles, PenTool, KeyRound, Check, X, Users, Globe, PenLine, BarChart3, Save, Bot, Gift } from 'lucide-react';
import SystemAgents from '@/pages/SystemAgents';
import { SignatureInput } from '@/components/client/SignatureInput';
import { WhatsAppIcon } from '@/components/shared/WhatsAppIcon';
import { ClientPortalSettingsTab } from '@/components/settings/ClientPortalSettingsTab';
import { WhatsAppSettingsTab } from '@/components/settings/WhatsAppSettingsTab';
import { PdfHeaderPreview } from '@/components/shared/PdfHeaderPreview';

import { useSystemSettings } from '@/hooks/useSystemSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { hexToHsl, getForegroundColor } from '@/lib/colorUtils';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useQuery } from '@tanstack/react-query';


export default function Settings() {
  const { profile, role, user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { settings: systemSettings, isLoading: isLoadingSystem, refetch: refetchSystem } = useSystemSettings();
  
  const [saving, setSaving] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  
  // Profile state
  const [profileData, setProfileData] = useState({
    name: profile?.name || '',
    phone: profile?.phone || '',
    avatarUrl: profile?.avatar_url || '',
    signatureData: null as string | null,
  });
  const [signatureLoaded, setSignatureLoaded] = useState(false);

  // Brand state
  const [brandData, setBrandData] = useState({
    systemName: '',
    systemSubtitle: '',
    logoUrl: '',
    pdfLogoUrl: '',
    loginLogoUrl: '',
    faviconUrl: '',
    primaryColor: '#991919',
    accentColor: '#1e1e1e',
    aiAvatarUrl: '',
  });

  // Load signature_data from DB
  useEffect(() => {
    if (user?.id && !signatureLoaded) {
      supabase
        .from('profiles')
        .select('signature_data')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setProfileData(p => ({ ...p, signatureData: (data as any).signature_data || null }));
          }
          setSignatureLoaded(true);
        });
    }
  }, [user?.id, signatureLoaded]);

  useEffect(() => {
    if (profile) {
      setProfileData(p => ({
        ...p,
        name: profile.name || '',
        phone: profile.phone || '',
        avatarUrl: profile.avatar_url || '',
      }));
    }
  }, [profile]);

  useEffect(() => {
    if (systemSettings) {
      setBrandData({
        systemName: systemSettings.system_name || '',
        systemSubtitle: systemSettings.system_subtitle || '',
        logoUrl: systemSettings.logo_url || '',
        pdfLogoUrl: systemSettings.pdf_logo_url || '',
        loginLogoUrl: systemSettings.login_logo_url || '',
        faviconUrl: systemSettings.favicon_url || '',
        primaryColor: systemSettings.primary_color || '#991919',
        accentColor: systemSettings.accent_color || '#1e1e1e',
        aiAvatarUrl: systemSettings.ai_avatar_url || '',
      });
    }
  }, [systemSettings]);
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // PIN state
  const [pinValue, setPinValue] = useState('');
  const [savingPin, setSavingPin] = useState(false);



  // Check if user has PIN configured
  const { data: hasPin, refetch: refetchPinStatus } = useQuery({
    queryKey: ['user-pin-status', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from('profiles')
        .select('pin_hash')
        .eq('id', user.id)
        .single();
      return !!data?.pin_hash;
    },
    enabled: !!user?.id,
  });

  const handleSetPin = async () => {
    if (pinValue.length !== 4 || !/^\d{4}$/.test(pinValue)) {
      toast({ title: 'PIN deve ter exatamente 4 dígitos numéricos', variant: 'destructive' });
      return;
    }

    setSavingPin(true);
    try {
      const { data, error } = await supabase.functions.invoke('set-pin', {
        body: { pin: pinValue }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Erro ao configurar PIN');
      }

      setPinValue('');
      refetchPinStatus();
      toast({ title: 'PIN configurado com sucesso!' });
    } catch (error) {
      console.error('Set PIN error:', error);
      toast({ 
        title: 'Erro ao configurar PIN', 
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive' 
      });
    } finally {
      setSavingPin(false);
    }
  };

  const handleRemovePin = async () => {
    setSavingPin(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ pin_hash: null })
        .eq('id', user?.id);

      if (error) throw error;

      refetchPinStatus();
      toast({ title: 'PIN removido com sucesso' });
    } catch (error) {
      console.error('Remove PIN error:', error);
      toast({ 
        title: 'Erro ao remover PIN', 
        variant: 'destructive' 
      });
    } finally {
      setSavingPin(false);
    }
  };

  const handleProfileSave = async () => {
    if (!profileData.name.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: profileData.name.trim(),
          phone: profileData.phone.trim() || null,
          avatar_url: profileData.avatarUrl || null,
          signature_data: profileData.signatureData || null,
        } as any)
        .eq('id', user?.id);

      if (error) throw error;

      await refreshProfile();
      toast({ title: 'Perfil atualizado com sucesso' });
    } catch (error) {
      console.error('Update profile error:', error);
      toast({ 
        title: 'Erro ao atualizar perfil', 
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordData.newPassword) {
      toast({ title: 'Digite a nova senha', variant: 'destructive' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({ title: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({ title: 'As senhas não conferem', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase as any).auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast({ title: 'Senha alterada com sucesso' });
    } catch (error) {
      console.error('Password change error:', error);
      toast({ 
        title: 'Erro ao alterar senha', 
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBrandSave = async () => {
    setSavingBrand(true);
    try {
      const primaryColor = brandData.primaryColor || '#991919';
      const accentColor = brandData.accentColor || '#1e1e1e';
      
      const updateData = {
        system_name: brandData.systemName || 'Sistema RDO',
        system_subtitle: brandData.systemSubtitle || 'Gestão de Atividades',
        logo_url: brandData.logoUrl || null,
        pdf_logo_url: brandData.pdfLogoUrl || null,
        login_logo_url: brandData.loginLogoUrl || null,
        favicon_url: brandData.faviconUrl || null,
        primary_color: primaryColor,
        accent_color: accentColor,
        ai_avatar_url: brandData.aiAvatarUrl || null,
        updated_at: new Date().toISOString(),
      };

      if (systemSettings?.id) {
        const { error, data } = await supabase
          .from('system_settings')
          .update(updateData)
          .eq('id', systemSettings.id)
          .select();

        if (error) throw error;
        
        // Verificar se realmente atualizou (pode falhar silenciosamente por RLS)
        if (!data || data.length === 0) {
          throw new Error('Você não tem permissão para atualizar as configurações. Contate um administrador.');
        }
      } else {
        const { error, data } = await supabase
          .from('system_settings')
          .insert(updateData)
          .select();

        if (error) throw error;
        
        if (!data || data.length === 0) {
          throw new Error('Você não tem permissão para criar configurações. Contate um administrador.');
        }
      }

      // Aplicar cores diretamente no DOM para feedback instantâneo
      const root = document.documentElement;
      const primaryHsl = hexToHsl(primaryColor);
      const accentHsl = hexToHsl(accentColor);
      const primaryForeground = getForegroundColor(primaryColor);
      const accentForeground = getForegroundColor(accentColor);

      root.style.setProperty('--primary', primaryHsl);
      root.style.setProperty('--primary-foreground', primaryForeground);
      root.style.setProperty('--accent', accentHsl);
      root.style.setProperty('--accent-foreground', accentForeground);
      root.style.setProperty('--ring', primaryHsl);
      root.style.setProperty('--sidebar-primary', primaryHsl);
      root.style.setProperty('--sidebar-primary-foreground', primaryForeground);
      root.style.setProperty('--sidebar-accent', accentHsl);
      root.style.setProperty('--sidebar-accent-foreground', accentForeground);

      toast({ title: 'Configurações da marca salvas com sucesso!' });
      refetchSystem();
    } catch (error) {
      console.error('Save brand error:', error);
      toast({ 
        title: 'Erro ao salvar configurações da marca', 
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive' 
      });
    } finally {
      setSavingBrand(false);
    }
  };

  const initials = profile?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';

  // Allow admin and super_admin to manage brand
  const canManageBrand = role === 'super_admin';
  const canManageWhatsApp = role === 'super_admin';
  const canManagePortal = role === 'super_admin' || role === 'admin';

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 md:pb-0 max-w-3xl mx-auto min-w-0">
      <div className="min-w-0">
        <h1 className="text-xl xs:text-2xl font-bold truncate">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie suas preferências</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="flex w-full h-auto flex-wrap gap-1">
          <TabsTrigger value="profile" className="gap-1.5 px-3 py-2 flex-shrink-0">
            <User className="h-4 w-4 shrink-0" />
            <span className="text-xs sm:text-sm">Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5 px-3 py-2 flex-shrink-0">
            <Shield className="h-4 w-4 shrink-0" />
            <span className="text-xs sm:text-sm">Segurança</span>
          </TabsTrigger>
          {canManageBrand && (
            <TabsTrigger value="system" className="gap-1.5 px-3 py-2 flex-shrink-0">
              <Settings2 className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm">Sistema</span>
            </TabsTrigger>
          )}
          {canManagePortal && (
            <TabsTrigger value="client-portal" className="gap-1.5 px-3 py-2 flex-shrink-0">
              <Globe className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm">Portal</span>
            </TabsTrigger>
          )}
          {canManageBrand && (
            <button
              type="button"
              onClick={() => window.location.href = '/admin/impact'}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-xs sm:text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 gap-1.5 flex-shrink-0 text-muted-foreground hover:text-foreground"
            >
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span>Métricas</span>
            </button>
          )}
          {canManageWhatsApp && (
            <TabsTrigger value="whatsapp" className="gap-1.5 px-3 py-2 flex-shrink-0">
              <WhatsAppIcon className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm">WhatsApp</span>
            </TabsTrigger>
          )}
          {canManageBrand && (
            <TabsTrigger value="agents" className="gap-1.5 px-3 py-2 flex-shrink-0">
              <Bot className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm">Agentes</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle>Meu Perfil</CardTitle>
              </div>
              <CardDescription>Suas informações pessoais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-full max-w-[240px] sm:max-w-xs">
                  <ImageUploader
                    image={profileData.avatarUrl}
                    onImageChange={(url) => setProfileData(p => ({ ...p, avatarUrl: url || '' }))}
                    label="Foto de Perfil"
                    enableEditor={true}
                    cropWidth={200}
                    cropHeight={200}
                    maxWidth={400}
                    maxHeight={400}
                    quality={0.85}
                    bucketName="service-report-photos"
                    folder="avatars"
                  />
                  <p className="text-xs text-muted-foreground mt-2 text-center sm:text-left">
                    Toque para selecionar uma foto
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-lg">{profile?.name}</p>
                  {role && <RoleBadge role={role as UserRole} />}
                </div>
              </div>

              <Separator />

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(e) => setProfileData(p => ({ ...p, name: e.target.value }))}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <PhoneInput
                    id="phone"
                    value={profileData.phone}
                    onChange={(value) => setProfileData(p => ({ ...p, phone: value }))}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={profile?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <PenLine className="h-4 w-4" />
                  Sua Assinatura Digital
                </Label>
                <p className="text-xs text-muted-foreground">
                  Esta assinatura será usada ao enviar documentos para assinatura digital.
                </p>
                <SignatureInput
                  onSignatureChange={(data) => setProfileData(p => ({ ...p, signatureData: data }))}
                  initialSignature={profileData.signatureData}
                />
              </div>

              <Button onClick={handleProfileSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Alterações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle>Segurança</CardTitle>
              </div>
              <CardDescription>Altere sua senha de acesso</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(p => ({ ...p, newPassword: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(p => ({ ...p, confirmPassword: e.target.value }))}
                      placeholder="Repita a nova senha"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <Button onClick={handlePasswordChange} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Alterar Senha
              </Button>
            </CardContent>
          </Card>

          {/* PIN Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                <CardTitle>PIN de Acesso Rápido</CardTitle>
              </div>
              <CardDescription>
                Configure um PIN de 4 dígitos para login rápido sem precisar digitar email e senha
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasPin ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-green-100 dark:bg-green-900/40 rounded-lg border border-green-300 dark:border-green-800">
                    <Check className="h-5 w-5 text-green-700 dark:text-green-400" />
                    <span className="text-sm text-green-800 dark:text-green-300 font-medium">
                      PIN configurado
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <Label>Alterar PIN</Label>
                    <div className="flex justify-center">
                      <InputOTP 
                        maxLength={4} 
                        value={pinValue} 
                        onChange={setPinValue}
                        disabled={savingPin}
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

                  <div className="flex gap-2">
                    <Button onClick={handleSetPin} disabled={savingPin || pinValue.length !== 4}>
                      {savingPin && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Atualizar PIN
                    </Button>
                    <Button variant="outline" onClick={handleRemovePin} disabled={savingPin}>
                      <X className="h-4 w-4 mr-2" />
                      Remover PIN
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <Label>Digite um PIN de 4 dígitos</Label>
                    <div className="flex justify-center">
                      <InputOTP 
                        maxLength={4} 
                        value={pinValue} 
                        onChange={setPinValue}
                        disabled={savingPin}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} className="w-12 h-12 text-lg" />
                          <InputOTPSlot index={1} className="w-12 h-12 text-lg" />
                          <InputOTPSlot index={2} className="w-12 h-12 text-lg" />
                          <InputOTPSlot index={3} className="w-12 h-12 text-lg" />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Use apenas números (0-9)
                    </p>
                  </div>

                  <Button onClick={handleSetPin} disabled={savingPin || pinValue.length !== 4} className="w-full">
                    {savingPin && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Configurar PIN
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tab - Admin/Super Admin Only */}
        {canManageBrand && (
          <TabsContent value="system" className="mt-6 space-y-6">
            <div className="flex items-center gap-2">
              <Palette className="h-6 w-6 text-primary" />
              <div>
                <h2 className="text-xl font-bold">Perfil da Marca</h2>
                <p className="text-sm text-muted-foreground">Configure a identidade visual do sistema</p>
              </div>
            </div>

            {/* Identity Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Type className="h-5 w-5 text-primary" />
                  <CardTitle>Identidade</CardTitle>
                </div>
                <CardDescription>Nome e descrição do sistema exibidos na interface</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="systemName">Nome do Sistema</Label>
                    <Input
                      id="systemName"
                      value={brandData.systemName}
                      onChange={(e) => setBrandData(p => ({ ...p, systemName: e.target.value }))}
                      placeholder="Sistema RDO"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="systemSubtitle">Subtítulo</Label>
                    <Input
                      id="systemSubtitle"
                      value={brandData.systemSubtitle}
                      onChange={(e) => setBrandData(p => ({ ...p, systemSubtitle: e.target.value }))}
                      placeholder="Gestão de Atividades"
                    />
                  </div>
                </div>

                <Separator />

                {/* Preview */}
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      {brandData.logoUrl ? (
                        <img
                          src={brandData.logoUrl}
                          alt="Logo"
                          className="h-12 w-12 object-contain rounded-lg"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: brandData.primaryColor + '20' }}>
                          <Building2 className="h-6 w-6" style={{ color: brandData.primaryColor }} />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-lg">{brandData.systemName || 'Sistema RDO'}</p>
                        <p className="text-sm text-muted-foreground">{brandData.systemSubtitle || 'Gestão de Atividades'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Identidade Visual Card - Logos + Cores unificados */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-primary" />
                  <CardTitle>Identidade Visual</CardTitle>
                </div>
                <CardDescription>Logos, cores e aparência do sistema e dos PDFs gerados</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Seção Logos */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Image className="h-4 w-4 text-primary" />
                    Logos
                  </Label>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Logo Principal</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Recomendado: imagem retangular 300x100px
                      </p>
                      <ImageUploader
                        image={brandData.logoUrl}
                        onImageChange={(url) => setBrandData(p => ({ ...p, logoUrl: url || '' }))}
                        label="Logo do Sistema"
                        enableEditor={true}
                        cropWidth={300}
                        cropHeight={100}
                        bucketName="company-photos"
                        folder="system"
                        previewSize="lg"
                        showPreviewCard={true}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Logo para PDF</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Logo específica para relatórios PDF (300x100px)
                      </p>
                      <ImageUploader
                        image={brandData.pdfLogoUrl}
                        onImageChange={(url) => setBrandData(p => ({ ...p, pdfLogoUrl: url || '' }))}
                        label="Logo para PDF"
                        enableEditor={true}
                        cropWidth={300}
                        cropHeight={100}
                        bucketName="company-photos"
                        folder="system"
                        previewSize="lg"
                        showPreviewCard={true}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Logo para Login</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Logo exibida na página de login (300x100px)
                      </p>
                      <ImageUploader
                        image={brandData.loginLogoUrl}
                        onImageChange={(url) => setBrandData(p => ({ ...p, loginLogoUrl: url || '' }))}
                        label="Logo para Login"
                        enableEditor={true}
                        cropWidth={300}
                        cropHeight={100}
                        bucketName="company-photos"
                        folder="system"
                        previewSize="lg"
                        showPreviewCard={true}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Favicon</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Ícone da aba do navegador (32x32px)
                      </p>
                      <ImageUploader
                        image={brandData.faviconUrl}
                        onImageChange={(url) => setBrandData(p => ({ ...p, faviconUrl: url || '' }))}
                        label="Favicon"
                        enableEditor={true}
                        cropWidth={32}
                        cropHeight={32}
                        bucketName="company-photos"
                        folder="system"
                        previewSize="md"
                        showPreviewCard={true}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Seção Assistente IA */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Assistente IA
                  </Label>
                  <div className="flex items-center gap-4">
                    <AvatarUpload
                      currentUrl={brandData.aiAvatarUrl || '/images/ai-assistant-default.png'}
                      name="Assistente IA"
                      onUpload={(url) => setBrandData(p => ({ ...p, aiAvatarUrl: url }))}
                      size="lg"
                    />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Foto do Assistente</p>
                      <p className="text-xs text-muted-foreground">
                        {brandData.aiAvatarUrl ? 'Imagem personalizada' : 'Usando imagem padrão'}
                      </p>
                      <p className="text-xs text-muted-foreground">Clique na foto para alterar</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Seção Cores */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Palette className="h-4 w-4 text-primary" />
                    Cores
                  </Label>
                  <div className="grid gap-6 md:grid-cols-2">
                    <ColorPicker
                      label="Cor Primária"
                      value={brandData.primaryColor}
                      onChange={(color) => setBrandData(p => ({ ...p, primaryColor: color }))}
                      description="Cor principal para botões, headers e destaques"
                    />

                    <ColorPicker
                      label="Cor de Destaque"
                      value={brandData.accentColor}
                      onChange={(color) => setBrandData(p => ({ ...p, accentColor: color }))}
                      description="Cor secundária para badges e elementos de destaque"
                    />
                  </div>
                </div>

                <Separator />

                {/* Preview de Componentes UI */}
                <div className="space-y-3">
                  <Label>Preview de Componentes</Label>
                  <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                    <div className="flex flex-wrap gap-3">
                      <Button 
                        style={{ backgroundColor: brandData.primaryColor }}
                        className="text-white hover:opacity-90"
                      >
                        Botão Primário
                      </Button>
                      <Button 
                        variant="outline" 
                        style={{ borderColor: brandData.primaryColor, color: brandData.primaryColor }}
                        className="hover:bg-transparent hover:opacity-80"
                      >
                        Botão Outline
                      </Button>
                      <Button 
                        variant="ghost"
                        style={{ color: brandData.primaryColor }}
                        className="hover:bg-transparent hover:opacity-80"
                      >
                        Botão Ghost
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge style={{ backgroundColor: brandData.primaryColor }} className="text-white">
                        Badge Primário
                      </Badge>
                      <Badge style={{ backgroundColor: brandData.accentColor }} className="text-white">
                        Badge Destaque
                      </Badge>
                      <Badge 
                        variant="outline" 
                        style={{ borderColor: brandData.primaryColor, color: brandData.primaryColor }}
                      >
                        Badge Outline
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <div 
                        className="h-6 w-1 rounded" 
                        style={{ backgroundColor: brandData.primaryColor }} 
                      />
                      <span 
                        className="font-semibold"
                        style={{ color: brandData.primaryColor }}
                      >
                        Título de Seção
                      </span>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <div 
                        className="px-4 py-2 text-white text-sm font-medium"
                        style={{ backgroundColor: brandData.primaryColor }}
                      >
                        Header do Card
                      </div>
                      <div className="p-3 bg-background text-xs text-muted-foreground">
                        Conteúdo do card com a cor de header aplicada
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Preview do Cabeçalho do PDF */}
                <div className="space-y-2">
                  <Label>Preview do Cabeçalho do PDF</Label>
                  <PdfHeaderPreview
                    primaryColor={brandData.primaryColor}
                    accentColor={brandData.accentColor}
                    pdfLogoUrl={brandData.pdfLogoUrl}
                    logoUrl={brandData.logoUrl}
                    companyName={brandData.systemName || "Empresa"}
                  />
                </div>

                <Button onClick={handleBrandSave} disabled={savingBrand} className="w-full">
                  {savingBrand && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar Configurações da Marca
                </Button>
              </CardContent>
            </Card>

          </TabsContent>
        )}



        {/* Client Portal Tab */}
        {canManagePortal && (
          <TabsContent value="client-portal" className="mt-6">
            <ClientPortalSettingsTab role={role || 'admin'} userId={user?.id || ''} />
          </TabsContent>
        )}

        {canManageWhatsApp && (
          <TabsContent value="whatsapp" className="mt-6">
            <WhatsAppSettingsTab />
          </TabsContent>
        )}

        {canManageBrand && (
          <TabsContent value="agents" className="mt-6">
            <SystemAgents />
          </TabsContent>
        )}

      </Tabs>
    </div>
  );
}
