import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { KeyRound, Loader2 } from 'lucide-react';

/**
 * Após o primeiro acesso por e-mail (link mágico), pede ao cliente que
 * escolha um PIN de 4 dígitos para os próximos logins.
 */
export function FirstAccessPinDialog({ userId }: { userId: string | null | undefined }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [contactId, setContactId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!userId) return;
      if (sessionStorage.getItem('firstAccessPinSkipped') === '1') return;
      const { data } = await supabase
        .from('company_contacts')
        .select('id, pin_hash')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();
      if (cancelled || !data) return;
      if (!data.pin_hash) {
        setContactId(data.id);
        setOpen(true);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [userId]);

  const handleSave = async () => {
    if (pin.length !== 4 || pin !== confirmPin || !contactId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('set-pin', {
        body: { pin, contactId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: 'PIN criado', description: 'Use seu PIN de 4 dígitos nos próximos acessos.' });
      setOpen(false);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar PIN', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const skip = () => {
    sessionStorage.setItem('firstAccessPinSkipped', '1');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) skip(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> Crie seu PIN de acesso
          </DialogTitle>
          <DialogDescription>
            Escolha um PIN de 4 dígitos para entrar mais rápido nas próximas vezes, sem precisar do e-mail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">Novo PIN</p>
            <InputOTP maxLength={4} value={pin} onChange={setPin}>
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3].map((i) => <InputOTPSlot key={i} index={i} className="h-12 w-12 text-lg" />)}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Confirme o PIN</p>
            <InputOTP maxLength={4} value={confirmPin} onChange={setConfirmPin}>
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3].map((i) => <InputOTPSlot key={i} index={i} className="h-12 w-12 text-lg" />)}
              </InputOTPGroup>
            </InputOTP>
            {confirmPin.length === 4 && confirmPin !== pin && (
              <p className="text-xs text-destructive">Os PINs não são iguais.</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={skip}>Agora não</Button>
          <Button onClick={handleSave} disabled={pin.length !== 4 || pin !== confirmPin || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
            Salvar PIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
