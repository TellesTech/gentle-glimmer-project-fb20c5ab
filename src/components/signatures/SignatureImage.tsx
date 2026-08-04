import { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dataUrlToBlobUrl, getSignatureKind, normalizeSignatureSrc } from '@/lib/signatureImage';

interface SignatureImageProps {
  value?: string | null;
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
export function SignatureImage({ value, alt, className, fallbackLabel }: SignatureImageProps) {
  const kind = getSignatureKind(value);
  const [src, setSrc] = useState<string | null>(normalizeSignatureSrc(value));
  const [failed, setFailed] = useState(false);
  const blobUrlRef = useRef<string | null>(null);
  const triedBlobRef = useRef(false);

  useEffect(() => {
    triedBlobRef.current = false;
    setFailed(false);
    setSrc(normalizeSignatureSrc(value));
  }, [value]);

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
    <img
      src={src}
      alt={alt}
      onError={handleError}
      className={cn('mx-auto object-contain', className)}
    />
  );
}
