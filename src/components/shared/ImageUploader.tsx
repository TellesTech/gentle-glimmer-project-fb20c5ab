import { useState, useCallback, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, Check, Pencil, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ImageEditor } from './ImageEditor';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { toast } from 'sonner';
import { compressImage, formatFileSize } from '@/lib/imageCompression';

interface ImageInfo {
  size: string;
  dimensions: string;
  type: string;
  originalSize?: string;
  originalDimensions?: string;
  wasResized?: boolean;
}

type PreviewSize = 'sm' | 'md' | 'lg' | 'xl';

interface ImageUploaderProps {
  image: string;
  onImageChange: (image: string) => void;
  label: string;
  accept?: string;
  className?: string;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  enableEditor?: boolean;
  cropWidth?: number;
  cropHeight?: number;
  bucketName?: string;
  folder?: string;
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
  onEditorOpen?: () => void;
  onEditorClose?: () => void;
  previewSize?: PreviewSize;
  showPreviewCard?: boolean;
}

const previewSizeClasses: Record<PreviewSize, string> = {
  sm: 'max-h-24',
  md: 'max-h-32',
  lg: 'max-h-48',
  xl: 'max-h-64',
};

export function ImageUploader({
  image,
  onImageChange,
  label,
  accept = 'image/*',
  className,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.8,
  enableEditor = true,
  cropWidth = 300,
  cropHeight = 200,
  bucketName = 'service-report-photos',
  folder,
  onUploadStart,
  onUploadEnd,
  onEditorOpen,
  onEditorClose,
  previewSize = 'sm',
  showPreviewCard = false,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [tempImage, setTempImage] = useState<string>('');
  const [isUploadingState, setIsUploadingState] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  
  const { uploadBase64, deleteFile, isUploading } = useStorageUpload(bucketName);

  const getBase64Size = (dataUrl: string): number => {
    const base64Length = dataUrl.split(',')[1]?.length || 0;
    return Math.round((base64Length * 3) / 4);
  };

  const getImageInfo = useCallback((dataUrl: string, originalInfo?: { size: number; width: number; height: number }) => {
    const isUrl = !dataUrl.startsWith('data:');
    
    if (isUrl) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setImageInfo({
          size: 'Storage',
          dimensions: `${img.width} x ${img.height} px`,
          type: 'URL',
        });
      };
      img.onerror = () => setImageInfo(null);
      img.src = dataUrl;
      return;
    }

    const sizeInBytes = getBase64Size(dataUrl);
    const typeMatch = dataUrl.match(/data:image\/(\w+);/);
    const type = typeMatch ? typeMatch[1].toUpperCase() : 'JPEG';

    const img = new window.Image();
    img.onload = () => {
      const info: ImageInfo = {
        size: formatFileSize(sizeInBytes),
        dimensions: `${img.width} x ${img.height} px`,
        type,
      };

      if (originalInfo && (originalInfo.width > img.width || originalInfo.height > img.height || originalInfo.size > sizeInBytes)) {
        info.originalSize = formatFileSize(originalInfo.size);
        info.originalDimensions = `${originalInfo.width} x ${originalInfo.height} px`;
        info.wasResized = true;
      }

      setImageInfo(info);
    };
    img.src = dataUrl;
  }, []);

  useEffect(() => {
    if (image) {
      getImageInfo(image);
      setImageLoadError(false);
    } else {
      setImageInfo(null);
      setImageLoadError(false);
    }
  }, [image, getImageInfo]);

  const resizeImage = useCallback((
    file: File,
    maxW: number,
    maxH: number,
    q: number
  ): Promise<{ dataUrl: string; originalInfo: { size: number; width: number; height: number } }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const originalInfo = {
            size: file.size,
            width: img.width,
            height: img.height,
          };

          let { width, height } = img;
          
          if (width > maxW || height > maxH) {
            const ratio = Math.min(maxW / width, maxH / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          
          // Detectar se é PNG para preservar transparência
          const isPng = file.type === 'image/png';
          
          if (!isPng && ctx) {
            // Preencher fundo branco apenas para JPEG (não PNG)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
          }
          
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Usar formato correto baseado no tipo original
          const format = isPng ? 'image/png' : 'image/jpeg';
          const resizedDataUrl = canvas.toDataURL(format, isPng ? undefined : q);
          resolve({ dataUrl: resizedDataUrl, originalInfo });
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const uploadToStorage = useCallback(async (dataUrl: string) => {
    console.log('[ImageUploader] Starting upload to bucket:', bucketName, 'folder:', folder);
    setIsUploadingState(true);
    onUploadStart?.();
    try {
      const { url, error } = await uploadBase64(dataUrl, folder);
      console.log('[ImageUploader] Upload result:', { url, error });
      
      if (error) {
        console.error('[ImageUploader] Upload error:', error);
        toast.error(`Erro ao enviar imagem: ${error.message}`);
        return null;
      }
      
      console.log('[ImageUploader] Upload success, URL:', url);
      return url;
    } catch (err) {
      console.error('[ImageUploader] Exception:', err);
      toast.error('Erro ao enviar imagem');
      return null;
    }
    // NOTE: setIsUploadingState and onUploadEnd are NOT called here.
    // Callers must call finishUpload() after onImageChange() to ensure
    // the form state has the URL before the Save button is re-enabled.
  }, [uploadBase64, folder, bucketName, onUploadStart]);

  const finishUpload = useCallback(() => {
    setIsUploadingState(false);
    onUploadEnd?.();
  }, [onUploadEnd]);

  const processFile = useCallback(async (file: File) => {
    console.log('[ImageUploader] processFile called with file:', file.name, file.size, file.type);
    
    if (!file.type.startsWith('image/')) {
      console.log('[ImageUploader] File is not an image, ignoring');
      return;
    }

    try {
      // Compress image first
      console.log('[ImageUploader] Starting compression...');
      const result = await compressImage(file, {
        maxWidth,
        maxHeight,
        quality,
        maxSizeKB: 300,
        preserveTransparency: true,
      });
      console.log('[ImageUploader] Compression complete, size:', result.compressedSize, 'format:', result.format);

      // Show compression feedback if significant
      if (result.compressionRatio > 0.1) {
        const saved = result.originalSize - result.compressedSize;
        toast.success(`Imagem otimizada: ${formatFileSize(saved)} economizados`);
      }

      // Convert blob to data URL for editor or upload
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(result.blob);
      });
      console.log('[ImageUploader] DataURL created, length:', dataUrl.length);

      if (enableEditor) {
        console.log('[ImageUploader] Opening editor with image');
        setTempImage(dataUrl);
        setIsEditing(true);
        onEditorOpen?.();
      } else {
        // Upload directly to storage
        console.log('[ImageUploader] Uploading directly (no editor)');
        const url = await uploadToStorage(dataUrl);
        if (url) {
          onImageChange(url);  // Set form state FIRST
          getImageInfo(url);
        }
        finishUpload();  // Re-enable save button AFTER onImageChange
      }
    } catch (err) {
      console.error('[ImageUploader] Error in processFile:', err);
      // Fallback to original resize method
      const { dataUrl } = await resizeImage(file, maxWidth, maxHeight, quality);
      
      if (enableEditor) {
        console.log('[ImageUploader] Opening editor with fallback image');
        setTempImage(dataUrl);
        setIsEditing(true);
        onEditorOpen?.();
      } else {
        const url = await uploadToStorage(dataUrl);
        if (url) {
          onImageChange(url);
          getImageInfo(url);
        }
        finishUpload();
      }
    }
  }, [onImageChange, maxWidth, maxHeight, quality, resizeImage, getImageInfo, enableEditor, uploadToStorage, finishUpload]);

  const handleEditorApply = useCallback(async (editedImage: string) => {
    console.log('[ImageUploader] handleEditorApply called, image length:', editedImage.length);
    setIsEditing(false);
    setTempImage('');
    onEditorClose?.();
    
    // Upload edited image to storage
    const url = await uploadToStorage(editedImage);
    console.log('[ImageUploader] Upload result URL:', url);
    if (url) {
      toast.success('Imagem enviada com sucesso!');
      onImageChange(url);  // Set form state FIRST
      getImageInfo(url);
    } else {
      console.error('[ImageUploader] Upload returned null URL');
    }
    finishUpload();  // Re-enable save button AFTER onImageChange
  }, [onImageChange, getImageInfo, uploadToStorage, finishUpload]);

  const handleEditorCancel = useCallback(() => {
    setIsEditing(false);
    setTempImage('');
    onEditorClose?.();
  }, [onEditorClose]);

  const handleEditExisting = useCallback(async () => {
    if (!image) return;
    
    // Se já é data URL, usar direto
    if (image.startsWith('data:')) {
      setTempImage(image);
      setIsEditing(true);
      onEditorOpen?.();
      return;
    }
    
    // Converter URL remota para data URL
    try {
      setIsUploadingState(true);
      const response = await fetch(image);
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      setTempImage(dataUrl);
      setIsEditing(true);
      onEditorOpen?.();
    } catch (error) {
      console.error('Error loading image for edit:', error);
      toast.error('Não foi possível carregar a imagem para edição');
    } finally {
      setIsUploadingState(false);
    }
  }, [image]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  const handleRemove = useCallback(async () => {
    // Try to delete from storage
    if (image && image.includes('supabase')) {
      deleteFile(image).catch(() => {
        // Ignore delete errors
      });
    }
    
    onImageChange('');
    setImageInfo(null);
  }, [onImageChange, image, deleteFile]);

  const showLoading = isUploading || isUploadingState;

  // Editor mode
  if (isEditing && tempImage) {
    return (
      <div className={cn('space-y-2', className)}>
        {label && <label className="text-sm font-medium">{label}</label>}
        <ImageEditor
          imageSrc={tempImage}
          onApply={handleEditorApply}
          onCancel={handleEditorCancel}
          cropWidth={cropWidth}
          cropHeight={cropHeight}
          quality={quality}
        />
      </div>
    );
  }

  // Loading state
  if (showLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        {label && <label className="text-sm font-medium">{label}</label>}
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 border-primary/50 bg-primary/5">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Enviando imagem...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label && <label className="text-sm font-medium">{label}</label>}
      
      {image && !imageLoadError ? (
        <div className="space-y-3">
          {/* Preview com background quadriculado e overlay hover */}
          <div 
            className={cn(
              "relative inline-block group rounded-lg overflow-hidden",
              showPreviewCard && "border-2 border-border shadow-sm p-2 bg-background"
            )}
          >
            {/* Background quadriculado para transparência */}
            <div 
              className="absolute inset-0 rounded-lg"
              style={{
                backgroundImage: 'repeating-conic-gradient(hsl(var(--muted)) 0% 25%, hsl(var(--background)) 0% 50%)',
                backgroundSize: '12px 12px'
              }}
            />
            <img
              src={image}
              alt={label}
              onError={() => setImageLoadError(true)}
              className={cn(
                "relative z-10 max-w-full rounded-lg object-contain",
                previewSizeClasses[previewSize]
              )}
            />
            {/* Overlay com botões ao passar mouse */}
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg p-2">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {enableEditor && (
                  <Button 
                    type="button" 
                    variant="secondary" 
                    size="sm" 
                    onClick={handleEditExisting}
                    className="shadow-lg"
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Editar
                  </Button>
                )}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept={accept}
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  <Button type="button" variant="secondary" size="sm" asChild className="shadow-lg">
                    <span>
                      <Upload className="mr-1 h-3 w-3" />
                      Trocar
                    </span>
                  </Button>
                </label>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleRemove}
                className="shadow-lg"
              >
                <X className="mr-1 h-3 w-3" />
                Deletar
              </Button>
            </div>
          </div>
          
          {imageInfo && (
            <div className="space-y-1">
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  📐 {imageInfo.dimensions}
                </span>
                <span className="flex items-center gap-1">
                  📦 {imageInfo.size}
                </span>
                <span className="flex items-center gap-1">
                  📄 {imageInfo.type}
                </span>
              </div>
              
              {imageInfo.wasResized && (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <Check className="h-3 w-3" />
                  <span>
                    Comprimida (original: {imageInfo.originalDimensions}, {imageInfo.originalSize})
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          )}
        >
          {imageLoadError && (
            <p className="mb-2 text-xs text-destructive">
              Imagem anterior não pôde ser carregada. Envie uma nova.
            </p>
          )}
          <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="mb-2 text-sm text-muted-foreground">
            Arraste uma imagem ou
          </p>
          <label className="cursor-pointer">
            <input
              type="file"
              accept={accept}
              onChange={handleFileInput}
              className="hidden"
            />
            <Button type="button" variant="outline" size="sm" asChild>
              <span>
                <Upload className="mr-2 h-3 w-3" />
                Selecionar arquivo
              </span>
            </Button>
          </label>
        </div>
      )}
    </div>
  );
}
