import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
// Tracks user interaction so we don't overwrite an existing saved signature with null on mount/tab switches.
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eraser, Check, Upload, Keyboard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SignatureInputProps {
  onSignatureChange: (signatureData: string | null) => void;
  disabled?: boolean;
  initialSignature?: string | null;
}

export function SignatureInput({ onSignatureChange, disabled = false, initialSignature }: SignatureInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userInteractedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<string>('type');
  const [typedName, setTypedName] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [signatureFontReady, setSignatureFontReady] = useState(false);

  useEffect(() => {
    let active = true;
    document.fonts.load('180px "Great Vibes"').then(() => {
      if (active) setSignatureFontReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const generateTypedSignature = useCallback((name: string): string | null => {
    const normalizedName = name.trim();
    if (!normalizedName || !signatureFontReady) return null;

    const fontFor = (size: number) => `${size}px "Great Vibes", "Dancing Script", cursive`;

    // Measure the REAL ink box (cursive flourishes overflow measureText().width),
    // then size the render surface around it so nothing is ever clipped.
    const measureCanvas = document.createElement('canvas');
    measureCanvas.width = 10;
    measureCanvas.height = 10;
    const measureCtx = measureCanvas.getContext('2d');
    if (!measureCtx) return null;

    const BASE = 100;
    measureCtx.font = fontFor(BASE);
    const m = measureCtx.measureText(normalizedName);
    const inkLeft = m.actualBoundingBoxLeft ?? 0;
    const inkRight = m.actualBoundingBoxRight ?? m.width;
    const baseInkWidth = Math.max(inkLeft + inkRight, m.width * 1.2, 1);
    const baseAscent = m.actualBoundingBoxAscent || BASE * 0.9;
    const baseDescent = m.actualBoundingBoxDescent || BASE * 0.5;
    const baseInkHeight = Math.max(baseAscent + baseDescent, 1);

    // Target ink area inside the source surface (leaves room for flourishes).
    const TARGET_W = 1500;
    const TARGET_H = 300;
    const fontScale = Math.min(TARGET_W / baseInkWidth, TARGET_H / baseInkHeight, 1.8);
    const fontSize = Math.max(24, Math.min(180, BASE * fontScale));

    const ratio = fontSize / BASE;
    const inkWidth = baseInkWidth * ratio;
    const inkHeight = baseInkHeight * ratio;
    const padX = Math.max(60, inkWidth * 0.12);
    const padY = Math.max(40, inkHeight * 0.25);

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = Math.ceil(inkWidth + padX * 2);
    sourceCanvas.height = Math.ceil(inkHeight + padY * 2);
    const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!sourceCtx) return null;

    sourceCtx.fillStyle = '#1a1a1a';
    sourceCtx.textAlign = 'left';
    sourceCtx.textBaseline = 'alphabetic';
    sourceCtx.font = fontFor(fontSize);
    // Position using the measured ink box so the first/last strokes stay inside.
    sourceCtx.fillText(
      normalizedName,
      padX + inkLeft * ratio,
      padY + baseAscent * ratio,
    );

    const pixels = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    let minX = sourceCanvas.width;
    let minY = sourceCanvas.height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < sourceCanvas.height; y += 1) {
      for (let x = 0; x < sourceCanvas.width; x += 1) {
        if (pixels.data[(y * sourceCanvas.width + x) * 4 + 3] > 8) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX < minX || maxY < minY) return null;

    const canvas = document.createElement('canvas');
    const width = 1600;
    const height = 400;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sourceWidth = maxX - minX + 1;
    const sourceHeight = maxY - minY + 1;
    // Keep a generous permanent margin inside the saved bitmap. This is
    // intentionally larger than the visual container padding because cursive
    // entry/exit strokes can otherwise look clipped after responsive scaling.
    const safeX = 160;
    const safeY = 56;
    const scale = Math.min(
      (width - safeX * 2) / sourceWidth,
      (height - safeY * 2) / sourceHeight,
      1,
    );
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    ctx.drawImage(
      sourceCanvas,
      minX,
      minY,
      sourceWidth,
      sourceHeight,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );

    return canvas.toDataURL('image/png');
  }, [signatureFontReady]);

  const typedSignaturePreview = useMemo(
    () => generateTypedSignature(typedName),
    [generateTypedSignature, typedName],
  );

  useEffect(() => {
    // Don't clobber a saved signature if the user hasn't interacted yet.
    if (!userInteractedRef.current) return;
    if (activeTab === 'type' && typedName.trim()) {
      const signature = generateTypedSignature(typedName);
      onSignatureChange(signature);
    } else if (activeTab === 'type') {
      onSignatureChange(null);
    }
  }, [typedName, activeTab, generateTypedSignature, onSignatureChange]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem (PNG, JPG)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setIsProcessing(true);

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxWidth = 900;
          const maxHeight = 240;
          
          let { width, height } = img;
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
          }

          canvas.width = maxWidth;
          canvas.height = maxHeight;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const x = (maxWidth - width) / 2;
            const y = (maxHeight - height) / 2;
            ctx.drawImage(img, x, y, width, height);
            
            const dataUrl = canvas.toDataURL('image/png');
            setUploadedImage(dataUrl);
            userInteractedRef.current = true;
            onSignatureChange(dataUrl);
          }
          setIsProcessing(false);
        };
        img.onerror = () => {
          toast.error('Erro ao processar imagem');
          setIsProcessing(false);
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        toast.error('Erro ao ler arquivo');
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error('Erro ao processar imagem');
      setIsProcessing(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearUploadedSignature = () => {
    userInteractedRef.current = true;
    setUploadedImage(null);
    onSignatureChange(null);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Only reset parent state if user has actually started a new signature.
    if (userInteractedRef.current) {
      onSignatureChange(null);
    }
    if (value === 'upload') {
      setUploadedImage(null);
    } else if (value === 'type') {
      setTypedName('');
    }
  };

  const hasSignature = 
    (activeTab === 'upload' && uploadedImage) ||
    (activeTab === 'type' && typedName.trim());

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="type" className="flex items-center gap-2" disabled={disabled}>
            <Keyboard className="w-4 h-4" />
            <span className="hidden sm:inline">Digitar</span>
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2" disabled={disabled}>
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Upload</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="type" className="mt-4">
          <div className="space-y-3">
            <Input
              placeholder="Digite seu nome completo"
              value={typedName}
              onChange={(e) => { userInteractedRef.current = true; setTypedName(e.target.value); }}
              disabled={disabled}
              className="text-lg"
            />
            
            {typedName.trim() && (
              <div className="w-full h-32 border-2 border-primary rounded-lg bg-white flex items-center justify-center overflow-hidden px-3">
                {typedSignaturePreview && (
                  <img
                    src={typedSignaturePreview}
                    alt={`Prévia da assinatura de ${typedName.trim()}`}
                    className="h-full w-full object-contain"
                  />
                )}
              </div>
            )}
            
            {!typedName.trim() && (
              <div className="w-full h-32 border-2 border-dashed rounded-lg bg-muted/30 flex items-center justify-center">
                <p className="text-muted-foreground text-sm">Sua assinatura aparecerá aqui</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="upload" className="mt-4">
          <div className="space-y-3">
            {uploadedImage ? (
              <div className="relative">
              <div className="w-full h-40 border-2 border-primary rounded-lg bg-white flex items-center justify-center overflow-visible px-8 py-4">
                  <img
                    src={uploadedImage} 
                    alt="Assinatura enviada" 
                    className="block h-auto max-h-full w-auto max-w-full object-contain"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearUploadedSignature}
                  className="mt-3"
                  disabled={disabled}
                >
                  <Eraser className="w-4 h-4 mr-2" />
                  Remover
                </Button>
              </div>
            ) : (
              <div 
                className={`w-full h-32 border-2 border-dashed rounded-lg bg-muted/30 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/50 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => !disabled && fileInputRef.current?.click()}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                    <p className="text-sm text-muted-foreground">Processando...</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Clique para enviar imagem</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG (máx 5MB)</p>
                  </>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={handleFileUpload}
              disabled={disabled || isProcessing}
            />
          </div>
        </TabsContent>
      </Tabs>

      {hasSignature && (
        <div className="flex items-center gap-2 text-success text-sm">
          <Check className="w-4 h-4" />
          <span>Assinatura capturada</span>
        </div>
      )}

      {initialSignature && !hasSignature && (
        <div className="p-3 bg-muted/30 rounded-lg border">
          <p className="text-xs text-muted-foreground mb-2">Assinatura salva anteriormente:</p>
          <img
            src={initialSignature} 
            alt="Assinatura salva" 
            className="h-16 w-full object-contain bg-white rounded border px-4 py-2"
          />
        </div>
      )}
    </div>
  );
}
