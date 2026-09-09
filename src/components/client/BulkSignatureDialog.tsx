import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SignatureInput } from './SignatureInput';
import { FileText, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { parseISO, differenceInDays } from 'date-fns';
import { getEdgeFunctionErrorMessage } from '@/lib/edgeFunctionError';

export interface BulkSignItem {
  reportApproverId: string;
  reportId: string;
  reportLabel: string;
  reportDate?: string;
  isLate?: boolean;
}

interface BulkSignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: BulkSignItem[];
  signerName: string;
  signerRole: string;
  signerEmail?: string;
  signerUserId?: string;
  initialSignature?: string | null;
  isContact: boolean;
  onCompleted?: () => void;
}

export function BulkSignatureDialog({
  open,
  onOpenChange,
  items,
  signerName,
  signerRole,
  signerEmail,
  signerUserId,
  initialSignature,
  isContact,
  onCompleted,
}: BulkSignatureDialogProps) {
  const [signatureData, setSignatureData] = useState<string | null>(initialSignature ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forceManual, setForceManual] = useState(false);
  const [saveToProfile, setSaveToProfile] = useState(true);
  const queryClient = useQueryClient();

  const hasSaved = !!initialSignature;
  const useOneClick = hasSaved && !forceManual;

  useEffect(() => {
    if (open) {
      setSignatureData(initialSignature ?? null);
      setForceManual(false);
      setSaveToProfile(true);
    }
  }, [open, initialSignature]);

  const handleSubmit = async () => {
    if (!signatureData) {
      toast.error('Capture sua assinatura para continuar');
      return;
    }
    if (items.length === 0) return;

    setIsSubmitting(true);
    try {
      // Geolocation (best effort)
      let geolocation: any = null;
      try {
        geolocation = await new Promise((resolve) => {
          if (!navigator.geolocation) return resolve(null);
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
            () => resolve(null),
            { timeout: 3000 }
          );
        });
      } catch { /* ignore */ }

      const { data, error } = await supabase.functions.invoke('submit-bulk-signatures', {
        body: {
          items: items.map(i => ({ reportId: i.reportId })),
          signatureData,
          geolocation,
        },
      });

      if (error) throw new Error(await getEdgeFunctionErrorMessage(error, 'Falha ao assinar os RDOs'));

      // Mark approvers as approved client-side (faster UI feedback)
      const approverIds = items.map(i => i.reportApproverId).filter(Boolean);
      if (approverIds.length > 0) {
        const table = isContact ? 'report_company_approvers' : 'report_client_approvers';
        await supabase
          .from(table)
          .update({ status: 'approved', approved_at: new Date().toISOString() })
          .in('id', approverIds);
      }

      const successCount = (data as any)?.successCount ?? items.length;

      toast.success(`${successCount} RDO(s) assinado(s)!`, {
        duration: 5000,
      });

      // Guarda a assinatura (digitada ou enviada) no perfil do cliente
      if (!useOneClick && saveToProfile && signatureData) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) {
            const { error: saveError } = await supabase.functions.invoke('save-client-signature', {
              body: { signatureData },
            });
            if (saveError) throw saveError;
            toast.success('Assinatura salva no seu perfil');
          }
        } catch (saveErr) {
          console.error('Erro ao salvar assinatura no perfil:', saveErr);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['client-dashboard-reports'] });
      queryClient.invalidateQueries({ queryKey: ['portal-responsibles'] });
      queryClient.invalidateQueries({ queryKey: ['client-profile'] });

      onCompleted?.();
      onOpenChange(false);
    } catch (e: any) {
      console.error('Bulk signature error:', e);
      toast.error(e?.message ?? 'Falha ao assinar em lote');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Assinar {items.length} RDO{items.length > 1 ? 's' : ''} de uma vez
          </DialogTitle>
          <DialogDescription>
            Sua assinatura será aplicada legalmente a todos os documentos selecionados.
          </DialogDescription>
        </DialogHeader>

        {/* Items list */}
        <ScrollArea className="flex-1 max-h-[240px] border rounded-lg p-2">
          <div className="space-y-1">
            {items.map((item) => (
              <div key={item.reportApproverId} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-muted/50">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{item.reportLabel}</span>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Signature capture */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Sua assinatura</p>

          {useOneClick ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Sua assinatura cadastrada será aplicada a todos os RDOs selecionados
              </p>
              <div className="w-full bg-white rounded-lg border-2 border-primary/30 flex items-center justify-center p-1">
                <SignatureImage
                  value={initialSignature}
                  signerName={signerName}
                  alt="Sua assinatura cadastrada"
                  className="h-24 w-full"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setForceManual(true);
                  setSignatureData(null);
                }}
                disabled={isSubmitting}
                className="w-full text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline transition-colors"
              >
                Usar outra assinatura desta vez
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <SignatureInput
                onSignatureChange={setSignatureData}
                signerName={signerName}
                disabled={isSubmitting}
              />
              <label className="flex items-start gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary"
                  checked={saveToProfile}
                  onChange={(e) => setSaveToProfile(e.target.checked)}
                  disabled={isSubmitting}
                />
                <span>
                  Salvar esta assinatura no meu perfil para assinar com 1 clique nas próximas vezes
                </span>
              </label>
              {hasSaved && (
                <button
                  type="button"
                  onClick={() => {
                    setForceManual(false);
                    setSignatureData(initialSignature ?? null);
                  }}
                  disabled={isSubmitting}
                  className="w-full text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline transition-colors"
                >
                  ← Voltar para minha assinatura cadastrada
                </button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !signatureData}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assinando {items.length}...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Assinar {items.length} RDO{items.length > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper to compute if a report is "late" (>7 days old)
export function isReportLate(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  try {
    return differenceInDays(new Date(), parseISO(dateStr)) > 7;
  } catch {
    return false;
  }
}
