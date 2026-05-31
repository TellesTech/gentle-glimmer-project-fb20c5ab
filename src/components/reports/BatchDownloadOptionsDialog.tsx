import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Download, FileSignature, Plus, X } from 'lucide-react';

interface BatchDownloadOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (options: {
    includeSignatureFields: boolean;
    signatureFieldLabels: string[];
    downloadWindow?: Window | null;
  }) => void;
  reportCount: number;
  folderName: string;
}

export function BatchDownloadOptionsDialog({
  open,
  onOpenChange,
  onConfirm,
  reportCount,
  folderName,
}: BatchDownloadOptionsDialogProps) {
  const [includeSignatureFields, setIncludeSignatureFields] = useState(false);
  const [signatureLabels, setSignatureLabels] = useState<string[]>([
    'Responsável pela Contratada',
    'Responsável pela Contratante',
  ]);

  const handleAddLabel = () => {
    setSignatureLabels([...signatureLabels, '']);
  };

  const handleRemoveLabel = (index: number) => {
    setSignatureLabels(signatureLabels.filter((_, i) => i !== index));
  };

  const handleLabelChange = (index: number, value: string) => {
    const newLabels = [...signatureLabels];
    newLabels[index] = value;
    setSignatureLabels(newLabels);
  };

  const handleConfirm = () => {
    // Open a window synchronously from the click gesture to avoid popup blockers.
    // We'll navigate it later when the ZIP is ready.
    const downloadWindow = window.open('about:blank', '_blank', 'noopener,noreferrer');

    if (!downloadWindow) {
      toast.error('Permita pop-ups para iniciar o download');
    }

    // Close dialog first to allow UI to update
    onOpenChange(false);

    // Then trigger the download (async operation)
    setTimeout(() => {
      onConfirm({
        includeSignatureFields,
        signatureFieldLabels: signatureLabels.filter((l) => l.trim() !== ''),
        downloadWindow,
      });
    }, 0);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Opções de Download
          </DialogTitle>
          <DialogDescription>
            Baixar <strong>{reportCount}</strong> relatório(s) de{' '}
            <strong>{folderName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="include-signatures"
              checked={includeSignatureFields}
              onCheckedChange={(checked) =>
                setIncludeSignatureFields(checked === true)
              }
            />
            <div className="space-y-1">
              <Label
                htmlFor="include-signatures"
                className="flex items-center gap-2 cursor-pointer"
              >
                <FileSignature className="h-4 w-4 text-muted-foreground" />
                Incluir campos de assinatura em branco
              </Label>
              <p className="text-xs text-muted-foreground">
                Adiciona campos para assinatura manuscrita no final de cada PDF
              </p>
            </div>
          </div>

          {includeSignatureFields && (
            <div className="ml-6 space-y-3 border-l-2 border-primary/20 pl-4">
              <Label className="text-sm font-medium">
                Rótulos dos campos de assinatura:
              </Label>
              <div className="space-y-2">
                {signatureLabels.map((label, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={label}
                      onChange={(e) => handleLabelChange(index, e.target.value)}
                      placeholder={`Campo ${index + 1}`}
                      className="flex-1 h-8 text-sm"
                    />
                    {signatureLabels.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleRemoveLabel(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddLabel}
                className="gap-1"
              >
                <Plus className="h-3 w-3" />
                Adicionar campo
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} className="gap-2">
            <Download className="h-4 w-4" />
            Baixar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
