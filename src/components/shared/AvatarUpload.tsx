import { useState, useRef } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ImageEditor } from './ImageEditor';

interface AvatarUploadProps {
  currentUrl?: string | null;
  name: string;
  onUpload: (url: string) => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

const sizeClasses = {
  sm: 'h-10 w-10',
  md: 'h-16 w-16',
  lg: 'h-24 w-24',
};

const iconSizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function AvatarUpload({ 
  currentUrl, 
  name, 
  onUpload, 
  size = 'md',
  disabled = false 
}: AvatarUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleOpenFilePicker = () => {
    if (!disabled && !uploading) {
      inputRef.current?.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Apenas imagens são permitidas', variant: 'destructive' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'A imagem deve ter no máximo 5MB', variant: 'destructive' });
      return;
    }

    // Convert to base64 and open editor
    const reader = new FileReader();
    reader.onload = (e) => {
      setPendingImage(e.target?.result as string);
      setEditMode(true);
    };
    reader.readAsDataURL(file);

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleEditorApply = async (editedImage: string) => {
    setEditMode(false);
    setPendingImage(null);
    setPreviewUrl(editedImage);
    setUploading(true);

    try {
      // Convert base64 to blob
      const response = await fetch(editedImage);
      const blob = await response.blob();

      // Generate unique filename
      const fileName = `${crypto.randomUUID()}.jpg`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/jpeg'
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      onUpload(publicUrl);
      toast({ title: 'Foto atualizada com sucesso' });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ 
        title: 'Erro ao fazer upload da foto', 
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive' 
      });
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleEditorCancel = () => {
    setEditMode(false);
    setPendingImage(null);
  };

  const displayUrl = previewUrl || currentUrl;

  const avatarElement = (
    <Avatar 
      className={cn(
        sizeClasses[size],
        'cursor-pointer transition-opacity hover:opacity-80',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      {displayUrl ? (
        <AvatarImage src={displayUrl} alt={name} className="object-cover" />
      ) : null}
      <AvatarFallback className="text-lg font-medium">
        {uploading ? (
          <Loader2 className={cn(iconSizeClasses[size], 'animate-spin')} />
        ) : (
          initials
        )}
      </AvatarFallback>
    </Avatar>
  );

  const cameraIcon = (
    <div 
      className={cn(
        'absolute bottom-0 right-0 rounded-full bg-primary text-primary-foreground p-1 cursor-pointer shadow-md transition-transform hover:scale-110',
        size === 'sm' && 'p-0.5',
        size === 'lg' && 'p-1.5'
      )}
    >
      {uploading ? (
        <Loader2 className={cn(iconSizeClasses[size], 'animate-spin')} />
      ) : (
        <Camera className={iconSizeClasses[size]} />
      )}
    </div>
  );

  return (
    <div className="relative inline-block">
      <div onClick={handleOpenFilePicker}>
        {avatarElement}
      </div>
      
      {!disabled && (
        <div onClick={handleOpenFilePicker}>
          {cameraIcon}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />

      <Dialog open={editMode} onOpenChange={(open) => !open && handleEditorCancel()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar Foto</DialogTitle>
            <DialogDescription>
              Arraste para reposicionar e use o zoom para ajustar sua foto
            </DialogDescription>
          </DialogHeader>
          
          {pendingImage && (
            <ImageEditor
              imageSrc={pendingImage}
              onApply={handleEditorApply}
              onCancel={handleEditorCancel}
              cropWidth={200}
              cropHeight={200}
              quality={0.85}
              circular
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
