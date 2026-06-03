import { useState, useRef, useEffect, useCallback } from 'react';
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

  const generateTypedSignature = useCallback((name: string): string | null => {
    if (!name.trim()) return null;

    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#1a1a1a';
    ctx.font = '56px "Great Vibes", "Dancing Script", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, canvas.width / 2, canvas.height / 2);

    return canvas.toDataURL('image/png');
  }, []);

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
          const maxWidth = 400;
          const maxHeight = 120;
          
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
              <div className="w-full h-32 border-2 border-primary rounded-lg bg-white flex items-center justify-center">
                <p 
                  className="text-5xl text-foreground"
                  style={{ fontFamily: '"Great Vibes", "Dancing Script", cursive' }}
                >
                  {typedName}
                </p>
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
                <div className="w-full h-32 border-2 border-primary rounded-lg bg-white flex items-center justify-center overflow-hidden">
                  <img 
                    src={uploadedImage} 
                    alt="Assinatura enviada" 
                    className="max-w-full max-h-full object-contain"
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
            className="h-12 object-contain bg-white rounded border"
          />
        </div>
      )}
    </div>
  );
}
