import { useSystemSettings } from '@/hooks/useSystemSettings';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ClientHeaderProps {
  clientName: string;
  clientCompany?: string;
  onBack?: () => void;
}

export function ClientHeader({ clientName, clientCompany, onBack }: ClientHeaderProps) {
  const { settings } = useSystemSettings();

  return (
    <header className="bg-primary text-primary-foreground py-4 px-6 shadow-lg">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="text-primary-foreground hover:bg-primary-foreground/10 -ml-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
          {(settings?.pdf_logo_url || settings?.logo_url) ? (
              <img src={settings?.pdf_logo_url || settings?.logo_url!} alt="Logo" className="w-7 h-7 object-contain" />
            ) : (
              <Building2 className="w-5 h-5 text-primary-foreground" />
            )}
          </div>
          <div>
            <h1 className="font-bold text-lg">Portal do Cliente</h1>
            <p className="text-primary-foreground/80 text-sm">WEES Soluções</p>
          </div>
        </div>
        
        <div className="text-right">
          <p className="font-medium text-sm">{clientName}</p>
          {clientCompany && (
            <p className="text-primary-foreground/70 text-xs">{clientCompany}</p>
          )}
        </div>
      </div>
    </header>
  );
}
