import { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dataUrlToBlobUrl, getSignatureKind, normalizeSignatureImage, normalizeSignatureSrc } from '@/lib/signatureImage';

interface SignatureImageProps {
  value?: string | null;
  signerName?: string | null;
  alt: string;
  className?: string;
  /** Texto do selo exibido quando a imagem não pode ser carregada. */
  fallbackLabel?: string;
}

/**
 * Exibe a imagem da assinatura de forma resiliente:
 *  - normaliza o valor (espaços, aspas, quebras de linha);
 *  - se a data URL falhar (ex.: CSP bloqueando `data:`), tenta novamente via blob:;
 *  - se ainda assim falhar, mostra um selo discreto em vez do ícone quebrado.
 */
export function SignatureImage({ value, signerName, alt, className, fallbackLabel }: SignatureImageProps) {
  const kind = getSignatureKind(value);
  const [src, setSrc] = useState<string | null>(normalizeSignatureSrc(value));
  const [failed, setFailed] = useState(false);
  const blobUrlRef = useRef<string | null>(null);
  const triedBlobRef = useRef(false);

  useEffect(() => {
    let active = true;
    triedBlobRef.current = false;
    setFailed(false);
    setSrc(null);
    normalizeSignatureImage(value, signerName).then((normalized) => {
      if (active) setSrc(normalized);
    });
    return () => {
      active = false;
    };
  }, [value, signerName]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const handleError = () => {
    if (!triedBlobRef.current) {
      triedBlobRef.current = true;
      const blobUrl = dataUrlToBlobUrl(value);
      if (blobUrl) {
        blobUrlRef.current = blobUrl;
        setSrc(blobUrl);
        return;
      }
    }
    setFailed(true);
  };

  if (kind === 'autentique') {
    return (
      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground py-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
        Assinado via Autentique
      </div>
    );
  }

  if (!src || failed) {
    if (kind === 'none' && !failed) return null;
    return (
      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground py-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
        {fallbackLabel || 'Assinatura registrada'}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex min-h-24 w-full items-center justify-center overflow-visible px-4 py-3 sm:px-8',
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        onError={handleError}
        className="block h-full max-h-full w-full max-w-full object-contain"
      />
    </div>
  );
}
