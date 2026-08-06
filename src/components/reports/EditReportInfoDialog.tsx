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
import { Loader2 } from 'lucide-react';

export interface ReportInfoValues {
  date: string;
  location: string;
  maintenance_order_number: string;
  maintenance_order_title: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: ReportInfoValues;
  isSaving?: boolean;
  onSave: (values: ReportInfoValues) => Promise<void> | void;
}

/** Edição rápida dos dados do RDO — reflete na WEES e no portal do cliente. */
export function EditReportInfoDialog({ open, onOpenChange, initial, isSaving, onSave }: Props) {
  const [values, setValues] = useState<ReportInfoValues>(initial);

  useEffect(() => {
    if (open) setValues(initial);
  }, [open, initial]);

  const set = (key: keyof ReportInfoValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar RDO</DialogTitle>
          <DialogDescription>
            As alterações aparecem tanto na área WEES quanto no portal do cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rdo-date">Data</Label>
            <Input id="rdo-date" type="date" value={values.date} onChange={set('date')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rdo-location">Local</Label>
            <Input id="rdo-location" value={values.location} onChange={set('location')} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rdo-om-number">Nº da OM</Label>
            <Input id="rdo-om-number" value={values.maintenance_order_number} onChange={set('maintenance_order_number')} maxLength={60} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rdo-om-title">Título da OM</Label>
            <Input id="rdo-om-title" value={values.maintenance_order_title} onChange={set('maintenance_order_title')} maxLength={200} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(values)} disabled={!!isSaving || !values.date}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditReportInfoDialog;