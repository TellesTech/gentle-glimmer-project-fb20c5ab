import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RotateCcw } from 'lucide-react';

export interface RenameActivityTarget {
  groupKey: string;
  siteId: string | null;
  currentName: string;
  hasCustomName: boolean;
}

interface Props {
  target: RenameActivityTarget | null;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => Promise<void> | void;
  onReset?: () => Promise<void> | void;
  isSaving?: boolean;
}

/** Renomeia a pasta de atividade. O nome vale para a WEES e para o portal do cliente. */
export function RenameActivityDialog({ target, onOpenChange, onSave, onReset, isSaving }: Props) {
  const [value, setValue] = useState('');

  useEffect(() => {
    setValue(target?.currentName ?? '');
  }, [target]);

  const disabled = !!isSaving || !value.trim() || !target?.siteId;

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renomear pasta</DialogTitle>
          <DialogDescription>
            O novo nome aparece tanto na área da WEES quanto no portal do cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="activity-name">Nome da pasta</Label>
          <Input
            id="activity-name"
            value={value}
            maxLength={150}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !disabled) onSave(value);
            }}
            placeholder="Ex.: OM 22461261 — Transportadora 09"
          />
          {!target?.siteId && (
            <p className="text-xs text-destructive">
              Não foi possível identificar a unidade desta atividade.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {target?.hasCustomName && onReset && (
            <Button type="button" variant="ghost" onClick={() => onReset()} disabled={isSaving}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Nome automático
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => onSave(value)} disabled={disabled}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}