import { useCallback, useState, useRef, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, Camera, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { toast } from 'sonner';
import { compressImages, formatFileSize } from '@/lib/imageCompression';

interface PhotoUploaderProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
  className?: string;
  folder?: string;
}

interface UploadingPhoto {
  id: string;
  preview: string;
}

export function PhotoUploader({ 
  photos, 
  onPhotosChange, 
  maxPhotos = 10, 
  className,
  folder 
}: PhotoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState<UploadingPhoto[]>([]);
  const { uploadFile, deleteFile, isUploading } = useStorageUpload('report-photos');

  // Refs to avoid stale closures in async processFiles
  const photosRef = useRef(photos);
  const onPhotosChangeRef = useRef(onPhotosChange);
  const uploadingPhotosRef = useRef(uploadingPhotos);

  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => { onPhotosChangeRef.current = onPhotosChange; }, [onPhotosChange]);
  useEffect(() => { uploadingPhotosRef.current = uploadingPhotos; }, [uploadingPhotos]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    processFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
    e.target.value = '';
  };

  const processFiles = async (files: File[]) => {
    const remainingSlots = maxPhotos - photosRef.current.length - uploadingPhotosRef.current.length;
    const filesToProcess = files.slice(0, remainingSlots);

    if (filesToProcess.length === 0) return;

    // Create temporary previews for uploading photos
    const newUploadingPhotos: UploadingPhoto[] = filesToProcess.map(file => ({
      id: Math.random().toString(36).substring(2),
      preview: URL.createObjectURL(file),
    }));

    setUploadingPhotos(prev => [...prev, ...newUploadingPhotos]);

    try {
      // Compress all images first
      const { results: compressedResults, totalSaved } = await compressImages(
        filesToProcess,
        {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 0.7,
          maxSizeKB: 500,
        }
      );

      // Show compression feedback
      if (totalSaved > 0) {
        toast.success(`Fotos otimizadas: ${formatFileSize(totalSaved)} economizados`);
      }

      // Upload each compressed file
      const uploadPromises = compressedResults.map(async (result, index) => {
        const uploadingPhoto = newUploadingPhotos[index];
        
        try {
          const { url, error } = await uploadFile(result.blob, folder);
          
          if (error) {
            toast.error(`Erro ao enviar foto: ${error.message}`);
            return null;
          }
          
          return { id: uploadingPhoto.id, url };
        } catch (err) {
          toast.error('Erro ao enviar foto');
          return null;
        }
      });

      const results = await Promise.all(uploadPromises);
      
      // Filter successful uploads and add to photos
      const successfulUrls = results
        .filter((r): r is { id: string; url: string } => r !== null && r.url !== '')
        .map(r => r.url);

      if (successfulUrls.length > 0) {
        onPhotosChangeRef.current([...photosRef.current, ...successfulUrls]);
      }

      // Clean up uploading photos
      const uploadedIds = results
        .filter((r): r is { id: string; url: string } => r !== null)
        .map(r => r.id);
      
      setUploadingPhotos(prev => prev.filter(p => !uploadedIds.includes(p.id)));
    } catch (err) {
      toast.error('Erro ao processar fotos');
      setUploadingPhotos(prev => prev.filter(p => !newUploadingPhotos.find(np => np.id === p.id)));
    }

    // Revoke object URLs
    newUploadingPhotos.forEach(p => URL.revokeObjectURL(p.preview));
  };

  const removePhoto = async (index: number) => {
    const photoUrl = photos[index];
    
    // Try to delete from storage (non-blocking)
    if (photoUrl.includes('supabase')) {
      deleteFile(photoUrl).catch(() => {
        // Ignore delete errors - file might already be removed
      });
    }

    const newPhotos = photos.filter((_, i) => i !== index);
    onPhotosChange(newPhotos);
  };

  const isDisabled = photos.length + uploadingPhotos.length >= maxPhotos;
  const totalCount = photos.length + uploadingPhotos.length;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Action Buttons */}
      <div className="flex gap-2">
        {/* Camera Capture */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileInput}
          className="hidden"
          id="camera-capture"
          disabled={isDisabled}
        />
        <label htmlFor="camera-capture" className="flex-1">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={isDisabled}
            asChild
          >
            <span>
              <Camera className="h-4 w-4 mr-2" />
              Tirar Foto
            </span>
          </Button>
        </label>

        {/* Gallery Upload */}
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInput}
          className="hidden"
          id="photo-upload"
          disabled={isDisabled}
        />
        <label htmlFor="photo-upload" className="flex-1">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={isDisabled}
            asChild
          >
            <span>
              <Upload className="h-4 w-4 mr-2" />
              Galeria
            </span>
          </Button>
        </label>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-xl p-4 text-center transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
          isDisabled && 'opacity-50 pointer-events-none'
        )}
      >
        <label htmlFor="photo-upload" className="cursor-pointer">
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm text-muted-foreground">
              Arraste fotos ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground">
              {totalCount}/{maxPhotos} fotos
            </p>
          </div>
        </label>
      </div>

      {/* Photo Grid */}
      {(photos.length > 0 || uploadingPhotos.length > 0) && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {/* Uploaded photos */}
          {photos.map((photo, index) => (
            <div key={photo} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
              <img
                src={photo}
                alt={`Foto ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removePhoto(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          
          {/* Uploading photos with loading overlay */}
          {uploadingPhotos.map((photo) => (
            <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden border border-border">
              <img
                src={photo.preview}
                alt="Enviando..."
                className="w-full h-full object-cover opacity-50"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && uploadingPhotos.length === 0 && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground py-2">
          <ImageIcon className="h-4 w-4" />
          <span className="text-sm">Nenhuma foto adicionada</span>
        </div>
      )}
    </div>
  );
}
