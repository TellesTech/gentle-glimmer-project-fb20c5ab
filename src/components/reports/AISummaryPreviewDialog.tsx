import { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, X, Check, Edit3 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AISummaryPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  generatedText: string;
  onAccept: (text: string) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

export function AISummaryPreviewDialog({
  open,
  onOpenChange,
  generatedText,
  onAccept,
  onRegenerate,
  isRegenerating,
}: AISummaryPreviewDialogProps) {
  const [editedText, setEditedText] = useState(generatedText);
  const [isEditing, setIsEditing] = useState(false);

  // Sincroniza quando o texto gerado muda
  useEffect(() => {
    setEditedText(generatedText);
    setIsEditing(false);
  }, [generatedText]);

  const handleAccept = () => {
    onAccept(editedText);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Resumo Técnico Gerado pela IA
          </DialogTitle>
          <DialogDescription>
            Revise o texto abaixo. Você pode editar, regenerar ou aceitar o resumo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-4 space-y-4">
          <div className="relative">
            <Textarea
              value={editedText}
              onChange={(e) => {
                setEditedText(e.target.value);
                setIsEditing(true);
              }}
              className="min-h-[200px] resize-none text-sm leading-relaxed"
              placeholder="O resumo gerado aparecerá aqui..."
              disabled={isRegenerating}
            />
            {isEditing && (
              <div className="absolute top-2 right-2">
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                  <Edit3 className="h-3 w-3" />
                  Editado
                </span>
              </div>
            )}
          </div>

          <Alert className="bg-muted/50 border-muted">
            <AlertDescription className="text-xs text-muted-foreground">
              💡 <strong>Dica:</strong> Você pode editar o texto acima antes de aceitar. 
              O texto será inserido no campo de observações do relatório.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="gap-2 w-full sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} />
            {isRegenerating ? 'Regenerando...' : 'Regenerar'}
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              disabled={isRegenerating}
              className="gap-2 flex-1 sm:flex-initial"
            >
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleAccept}
              disabled={isRegenerating || !editedText.trim()}
              className="gap-2 flex-1 sm:flex-initial"
            >
              <Check className="h-4 w-4" />
              Aceitar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
