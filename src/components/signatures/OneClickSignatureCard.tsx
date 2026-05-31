import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PenLine, Check, Loader2, Building2, Sparkles } from 'lucide-react';
import { SignatureInput } from '@/components/client/SignatureInput';

export interface OneClickSignerIdentity {
  name: string;
  role?: string;
  company?: string;
  isWees?: boolean;
  /** Saved signature image (data URL). When present, enables 1-click flow. */
  savedSignature?: string | null;
}

interface OneClickSignatureCardProps {
  identity: OneClickSignerIdentity;
  /**
   * Called with the signature data URL to actually submit.
   * The card already handles "use saved" vs "use a new one" internally.
   */
  onSign: (signatureData: string) => void | Promise<void>;
  isSubmitting?: boolean;
  /** Optional title override. Defaults to "Assinar Relatório". */
  title?: string;
  /** Optional cadastrar-firma callback. If provided, shows a CTA when no saved signature exists. */
  onRegisterSignature?: () => void;
}

/**
 * Unified signature card. When the user already has a `savedSignature`,
 * shows a single big "Assinar com minha firma" button (1-click flow).
 * Otherwise falls back to the classic Digitar/Upload input.
 */
export function OneClickSignatureCard({
  identity,
  onSign,
  isSubmitting = false,
  title = 'Assinar Relatório',
  onRegisterSignature,
}: OneClickSignatureCardProps) {
  const hasSaved = !!identity.savedSignature;
  // When the user explicitly chooses "use a different signature this time",
  // we toggle into manual mode for this single signing.
  const [forceManual, setForceManual] = useState(false);
  const [manualSignature, setManualSignature] = useState<string | null>(null);

  const useOneClick = hasSaved && !forceManual;

  const handleClickSign = async () => {
    if (useOneClick) {
      await onSign(identity.savedSignature!);
      return;
    }
    if (!manualSignature) return;
    await onSign(manualSignature);
  };

  return (
    <Card className="border-2 border-primary">
      <CardHeader className="bg-primary/5 border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <PenLine className="w-5 h-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {/* Identity row */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Assinando como:{' '}
            <strong className="text-foreground">{identity.name}</strong>
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
            {identity.role && <span className="uppercase">{identity.role}</span>}
            {identity.company && (
              <>
                <span>·</span>
                <Building2 className="w-3 h-3" />
                <span>{identity.company}</span>
              </>
            )}
            {identity.isWees && (
              <Badge variant="secondary" className="ml-1 text-[10px] py-0 px-1.5">
                Equipe WEES
              </Badge>
            )}
          </p>
        </div>

        {useOneClick ? (
          <>
            {/* Saved signature preview */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Sua firma cadastrada será aplicada ao relatório
              </p>
              <div className="w-full p-3 bg-white rounded-lg border-2 border-primary/30 flex items-center justify-center min-h-[88px]">
                <img
                  src={identity.savedSignature!}
                  alt="Sua assinatura cadastrada"
                  className="max-h-20 object-contain"
                />
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleClickSign}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Assinar e Aprovar Relatório
                </>
              )}
            </Button>

            <button
              type="button"
              onClick={() => setForceManual(true)}
              disabled={isSubmitting}
              className="w-full text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline transition-colors"
            >
              Usar outra assinatura desta vez
            </button>
          </>
        ) : (
          <>
            <SignatureInput
              onSignatureChange={setManualSignature}
              disabled={isSubmitting}
            />

            <Button
              className="w-full"
              size="lg"
              onClick={handleClickSign}
              disabled={isSubmitting || !manualSignature}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Assinar e Aprovar Relatório
                </>
              )}
            </Button>

            {hasSaved && forceManual && (
              <button
                type="button"
                onClick={() => {
                  setForceManual(false);
                  setManualSignature(null);
                }}
                disabled={isSubmitting}
                className="w-full text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline transition-colors"
              >
                ← Voltar para minha firma cadastrada
              </button>
            )}

            {!hasSaved && onRegisterSignature && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                💡 Dica:{' '}
                <button
                  type="button"
                  onClick={onRegisterSignature}
                  className="text-primary underline"
                  disabled={isSubmitting}
                >
                  cadastre sua firma no perfil
                </button>{' '}
                e assine com 1 clique nas próximas vezes.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
