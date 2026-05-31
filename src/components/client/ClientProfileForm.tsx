import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { SignatureInput } from './SignatureInput';
import { User, Building2, Briefcase, Save, Loader2 } from 'lucide-react';

interface ClientProfile {
  email: string;
  name: string;
  company?: string;
  role?: string;
  signature_data?: string | null;
}

interface ClientProfileFormProps {
  email: string;
  initialData?: Partial<ClientProfile>;
  onSubmit: (profile: ClientProfile) => Promise<void>;
  isSubmitting?: boolean;
  mode?: 'register' | 'edit';
}

export function ClientProfileForm({ 
  email, 
  initialData, 
  onSubmit, 
  isSubmitting = false,
  mode = 'register'
}: ClientProfileFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [company, setCompany] = useState(initialData?.company || '');
  const [role, setRole] = useState(initialData?.role || '');
  const [signatureData, setSignatureData] = useState<string | null>(initialData?.signature_data || null);
  const [saveSignature, setSaveSignature] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await onSubmit({
      email,
      name: name.trim(),
      company: company.trim() || undefined,
      role: role.trim() || undefined,
      signature_data: saveSignature ? signatureData : null,
    });
  };

  const isValid = name.trim().length > 0;

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          {mode === 'register' ? 'Cadastre-se para Aprovação Rápida' : 'Editar Perfil'}
        </CardTitle>
        <CardDescription>
          {mode === 'register' 
            ? 'Salve seus dados e assinatura para aprovar relatórios futuros com um clique'
            : 'Atualize suas informações e assinatura'}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profileName" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Nome Completo *
              </Label>
              <Input
                id="profileName"
                placeholder="Seu nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="profileRole" className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Cargo
              </Label>
              <Input
                id="profileRole"
                placeholder="Ex: Engenheiro Civil"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="profileCompany" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Fábrica
            </Label>
            <Input
              id="profileCompany"
              placeholder="Nome da sua fábrica"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              Sua Assinatura
            </Label>
            <SignatureInput
              onSignatureChange={setSignatureData}
              disabled={isSubmitting}
              initialSignature={initialData?.signature_data}
            />
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="saveSignature"
                checked={saveSignature}
                onCheckedChange={(checked) => setSaveSignature(checked === true)}
                disabled={isSubmitting}
              />
              <label
                htmlFor="saveSignature"
                className="text-sm text-muted-foreground cursor-pointer"
              >
                Salvar assinatura para aprovações futuras
              </label>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            size="lg"
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {mode === 'register' ? 'Salvar Perfil' : 'Atualizar Perfil'}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
