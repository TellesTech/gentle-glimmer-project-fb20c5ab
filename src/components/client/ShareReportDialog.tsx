import { useState } from 'react';
import { format, addDays } from 'date-fns';
import { Copy, Check, Link2, Loader2, Mail, Building2, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface ShareReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
}

export function ShareReportDialog({ open, onOpenChange, reportId }: ShareReportDialogProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [clientName, setClientName] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [expirationDays, setExpirationDays] = useState('7');

  const handleGenerateLink = async () => {
    if (!clientName.trim()) {
      toast.error('Nome do cliente é obrigatório');
      return;
    }

    setIsLoading(true);
    try {
      const expiresAt = expirationDays === 'never' 
        ? null 
        : addDays(new Date(), parseInt(expirationDays)).toISOString();

      const { data, error } = await supabase
        .from('client_report_access')
        .insert({
          report_id: reportId,
          client_name: clientName.trim(),
          client_company: clientCompany.trim() || null,
          client_email: clientEmail.trim() || null,
          expires_at: expiresAt,
          created_by: user?.id,
        })
        .select('access_token')
        .single();

      if (error) throw error;

      const link = `${window.location.origin}/client/report/${data.access_token}`;
      setGeneratedLink(link);
      toast.success('Link gerado com sucesso!');
    } catch (error) {
      console.error('Error generating link:', error);
      toast.error('Erro ao gerar link de compartilhamento');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Erro ao copiar link');
    }
  };

  const handleClose = () => {
    setGeneratedLink(null);
    setClientName('');
    setClientCompany('');
    setClientEmail('');
    setExpirationDays('7');
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            Compartilhar com Cliente
          </DialogTitle>
          <DialogDescription>
            Gere um link seguro para o cliente visualizar e assinar o relatório.
          </DialogDescription>
        </DialogHeader>

        {!generatedLink ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="clientName" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Nome do Cliente *
              </Label>
              <Input
                id="clientName"
                placeholder="Ex: João Silva"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientCompany" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Fábrica (opcional)
              </Label>
              <Input
                id="clientCompany"
                placeholder="Ex: Construtora ABC"
                value={clientCompany}
                onChange={(e) => setClientCompany(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientEmail" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                E-mail (opcional)
              </Label>
              <Input
                id="clientEmail"
                type="email"
                placeholder="Ex: joao@exemplo.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Validade do Link</Label>
              <Select value={expirationDays} onValueChange={setExpirationDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 dia</SelectItem>
                  <SelectItem value="3">3 dias</SelectItem>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="never">Sem expiração</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              className="w-full" 
              onClick={handleGenerateLink}
              disabled={isLoading || !clientName.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  Gerar Link
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="bg-success/10 border border-success/20 rounded-lg p-4">
              <p className="text-success font-medium text-sm mb-2">Link gerado com sucesso!</p>
              <p className="text-xs text-muted-foreground">
                Cliente: {clientName}
                {clientCompany && ` • ${clientCompany}`}
                {expirationDays !== 'never' && (
                  ` • Expira em ${format(addDays(new Date(), parseInt(expirationDays)), 'dd/MM/yyyy')}`
                )}
              </p>
            </div>

            <div className="flex gap-2">
              <Input
                readOnly
                value={generatedLink}
                className="font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={handleCopyLink}>
                {copied ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Fechar
              </Button>
              <Button 
                className="flex-1" 
                onClick={() => {
                  setGeneratedLink(null);
                  setClientName('');
                  setClientCompany('');
                  setClientEmail('');
                }}
              >
                Gerar Outro
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
