import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SafeImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  fallbackLabel?: string;
}

/**
 * <img> com fallback visual amigável quando o carregamento falha (ex.: URLs
 * herdadas de um Supabase antigo que não responde mais). Evita o ícone
 * "quebrado" nativo do navegador.
 */
export function SafeImg({ src, alt, className, fallbackLabel = 'Foto indisponível', ...rest }: SafeImgProps) {
  const [errored, setErrored] = useState(false);
  useEffect(() => { setErrored(false); }, [src]);

  if (!src || errored) {
    return (
      <div className={cn('flex flex-col items-center justify-center bg-muted text-muted-foreground text-[10px] gap-1 w-full h-full', className)}>
        <ImageOff className="w-4 h-4 opacity-60" />
        <span className="px-1 text-center leading-tight">{fallbackLabel}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => {
        console.warn('[SafeImg] falha ao carregar imagem:', src);
        setErrored(true);
      }}
      {...rest}
    />
  );
}