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
import { Progress } from '@/components/ui/progress';
import { Download, Cloud, Loader2, FileArchive, FileText } from 'lucide-react';
import type { BatchExportFormat, BatchExportDestination, BatchExportProgress } from '@/lib/generateBatchReportsPdf';

interface BatchExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onExport: (format: BatchExportFormat, destination: BatchExportDestination) => void;
  isExporting: boolean;
  progress?: BatchExportProgress | null;
}

export function BatchExportDialog({
  open,
  onOpenChange,
  selectedCount,
  onExport,
  isExporting,
  progress,
}: BatchExportDialogProps) {
  const [format, setFormat] = useState<BatchExportFormat>('zip');
  const [destination, setDestination] = useState<BatchExportDestination>('download');

  const handleConfirm = () => {
    onExport(format, destination);
  };

  const progressPercent = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar {selectedCount} Relatórios</DialogTitle>
          <DialogDescription>
            Escolha o formato e destino da exportação em lote
          </DialogDescription>
        </DialogHeader>

        {isExporting ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processando relatórios...</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            {progress && (
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">
                  {progress.current} de {progress.total} relatórios
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {progress.currentReportName}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Format Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Formato de Exportação</Label>
              <RadioGroup
                value={format}
                onValueChange={(value) => setFormat(value as BatchExportFormat)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="zip" id="zip" />
                  <Label htmlFor="zip" className="flex items-center gap-2 cursor-pointer flex-1">
                    <FileArchive className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">ZIP com PDFs Individuais</p>
                      <p className="text-sm text-muted-foreground">Cada relatório em um arquivo separado</p>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="combined" id="combined" />
                  <Label htmlFor="combined" className="flex items-center gap-2 cursor-pointer flex-1">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">PDF Combinado</p>
                      <p className="text-sm text-muted-foreground">Todos relatórios em um único arquivo</p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Destination Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Destino</Label>
              <RadioGroup
                value={destination}
                onValueChange={(value) => setDestination(value as BatchExportDestination)}
                className="space-y-2"
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
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exportando...
              </>
            ) : (
              'Exportar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
