import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Download, Cloud, Loader2 } from 'lucide-react';

export type ExportDestination = 'download' | 'cloud' | 'both';

interface ExportOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (destination: ExportDestination) => void;
  title: string;
  description?: string;
  isLoading?: boolean;
}

export function ExportOptionsDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  isLoading = false,
}: ExportOptionsDialogProps) {
  const [destination, setDestination] = useState<ExportDestination>('download');

  const handleConfirm = () => {
    onConfirm(destination);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <RadioGroup
          value={destination}
          onValueChange={(value) => setDestination(value as ExportDestination)}
          className="space-y-3"
        >
          <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="download" id="download" />
            <Label htmlFor="download" className="flex items-center gap-2 cursor-pointer flex-1">
              <Download className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Baixar para o computador</p>
                <p className="text-sm text-muted-foreground">Download direto do arquivo</p>
              </div>
            </Label>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="cloud" id="cloud" />
            <Label htmlFor="cloud" className="flex items-center gap-2 cursor-pointer flex-1">
              <Cloud className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Salvar na nuvem</p>
                <p className="text-sm text-muted-foreground">Disponível em Exportações Salvas</p>
              </div>
            </Label>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="both" id="both" />
            <Label htmlFor="both" className="flex items-center gap-2 cursor-pointer flex-1">
              <div className="flex">
                <Download className="w-4 h-4 text-muted-foreground" />
                <Cloud className="w-4 h-4 text-muted-foreground -ml-1" />
              </div>
              <div>
                <p className="font-medium">Ambos</p>
                <p className="text-sm text-muted-foreground">Baixar e salvar na nuvem</p>
              </div>
            </Label>
          </div>
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exportando...
              </>
            ) : (
              'Confirmar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
