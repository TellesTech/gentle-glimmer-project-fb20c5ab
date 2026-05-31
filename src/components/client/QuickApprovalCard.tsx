import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle2, XCircle, User, Building2, Briefcase, 
  PenLine, Loader2, ChevronDown, ChevronUp 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientProfile {
  id: string;
  email: string;
  name: string;
  company?: string;
  role?: string;
  signature_data?: string | null;
}

interface QuickApprovalCardProps {
  profile: ClientProfile;
  onApprove: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  onEditProfile: () => void;
  isSubmitting?: boolean;
}

export function QuickApprovalCard({
  profile,
  onApprove,
  onReject,
  onEditProfile,
  isSubmitting = false,
}: QuickApprovalCardProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);

  const handleApprove = async () => {
    setAction('approve');
    await onApprove();
    setAction(null);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setAction('reject');
    await onReject(rejectReason.trim());
    setAction(null);
  };

  return (
    <Card className="border-2 border-success overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-success/10 to-success/5 border-b pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2 text-success">
              <CheckCircle2 className="w-5 h-5" />
              Perfil Encontrado
            </CardTitle>
            <CardDescription className="mt-1">
              Aprove ou rejeite o relatório com um clique
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onEditProfile} disabled={isSubmitting}>
            <PenLine className="w-4 h-4 mr-1" />
            Editar
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        {/* Profile Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
            <User className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Nome</p>
              <p className="font-medium">{profile.name}</p>
            </div>
          </div>
          
          {profile.role && (
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <Briefcase className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Cargo</p>
                <p className="font-medium">{profile.role}</p>
              </div>
            </div>
          )}
          
          {profile.company && (
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <Building2 className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Empresa</p>
                <p className="font-medium">{profile.company}</p>
              </div>
            </div>
          )}
        </div>

        {/* Saved Signature */}
        {profile.signature_data && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Sua Assinatura Salva:</p>
            <div className="p-3 bg-white rounded-lg border flex items-center justify-center">
              <img 
                src={profile.signature_data} 
                alt="Assinatura" 
                className="max-h-20 object-contain"
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              className="w-full bg-success hover:bg-success/90"
              onClick={handleApprove}
              disabled={isSubmitting || !profile.signature_data}
            >
              {action === 'approve' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Aprovando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Aprovar Relatório
                </>
              )}
            </Button>
            
            <Button
              size="lg"
              variant="outline"
              className={cn(
                "w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground",
                showRejectForm && "bg-destructive/10"
              )}
              onClick={() => setShowRejectForm(!showRejectForm)}
              disabled={isSubmitting}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Rejeitar
              {showRejectForm ? (
                <ChevronUp className="w-4 h-4 ml-2" />
              ) : (
                <ChevronDown className="w-4 h-4 ml-2" />
              )}
            </Button>
          </div>

          {!profile.signature_data && (
            <p className="text-sm text-muted-foreground text-center">
              Você precisa cadastrar uma assinatura para aprovar. 
              <button 
                onClick={onEditProfile} 
                className="text-primary underline ml-1"
                disabled={isSubmitting}
              >
                Clique aqui para adicionar
              </button>
            </p>
          )}
        </div>

        {/* Reject Form */}
        {showRejectForm && (
          <div className="space-y-3 p-4 bg-destructive/5 rounded-lg border border-destructive/20">
            <Label htmlFor="rejectReason" className="flex items-center gap-2 text-destructive">
              <XCircle className="w-4 h-4" />
              Motivo da Rejeição *
            </Label>
            <Textarea
              id="rejectReason"
              placeholder="Descreva o motivo da rejeição..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              disabled={isSubmitting}
              rows={3}
            />
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleReject}
              disabled={!rejectReason.trim() || isSubmitting}
            >
              {action === 'reject' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Confirmar Rejeição
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
