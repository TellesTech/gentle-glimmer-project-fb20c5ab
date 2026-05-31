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
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) setSignatureData(initialSignature ?? null);
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
          signerName,
          signerRole,
          signerEmail,
          signerUserId,
          geolocation,
        },
      });

      if (error) throw error;

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

      queryClient.invalidateQueries({ queryKey: ['client-dashboard-reports'] });

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
          <SignatureInput
            onSignatureChange={setSignatureData}
            initialSignature={initialSignature}
            disabled={isSubmitting}
          />
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
