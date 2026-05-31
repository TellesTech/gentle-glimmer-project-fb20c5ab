import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImagePlus, Trash2, Pencil, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';
import { ImageAnnotator } from '@/components/shared/ImageAnnotator';
import { cn } from '@/lib/utils';

export interface PhotoItem {
  id: string;
  url: string;
  caption: string;
  layout: 'full' | 'half' | 'third';
  order_index: number;
  customHeight?: number;
  objectFit?: 'cover' | 'contain';
  widthPercent?: number; // 10-100, default 50
}

interface PhotoBlockEditorProps {
  sectionId: string;
  photos: PhotoItem[];
  onChange: (photos: PhotoItem[]) => void;
  onEditPhoto?: (photo: PhotoItem) => void;
  activePhotoId?: string | null;
}

export function PhotoBlockEditor({ sectionId, photos, onChange, onEditPhoto, activePhotoId }: PhotoBlockEditorProps) {
  const [uploading, setUploading] = useState(false);
  const [annotatingPhoto, setAnnotatingPhoto] = useState<PhotoItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activePhotoId && activeRowRef.current) {
      activeRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activePhotoId]);

  const handleAnnotationApply = async (annotatedDataUrl: string) => {
    if (!annotatingPhoto) return;
    // Upload the annotated image
    try {
      const response = await fetch(annotatedDataUrl);
      const blob = await response.blob();
      const fileName = `${sectionId}/${crypto.randomUUID()}-annotated.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('service-report-photos')
        .upload(fileName, blob);
      if (uploadError) {
        toast.error('Erro ao salvar anotação');
        return;
      }
      const { data: urlData } = supabase.storage
        .from('service-report-photos')
        .getPublicUrl(fileName);
      onChange(photos.map((p) => (p.id === annotatingPhoto.id ? { ...p, url: urlData.publicUrl } : p)));
      toast.success('Anotação aplicada');
    } catch {
      toast.error('Erro ao processar anotação');
    } finally {
      setAnnotatingPhoto(null);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newPhotos: PhotoItem[] = [];

    try {
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file);
        const fileName = `${sectionId}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('service-report-photos')
          .upload(fileName, compressed.blob);

        if (uploadError) {
          toast.error(`Erro ao enviar ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('service-report-photos')
          .getPublicUrl(fileName);

        newPhotos.push({
          id: crypto.randomUUID(),
          url: urlData.publicUrl,
          caption: '',
          layout: 'half',
          order_index: photos.length + newPhotos.length,
        });
      }

      onChange([...photos, ...newPhotos]);
      if (newPhotos.length > 0) toast.success(`${newPhotos.length} foto(s) enviada(s)`);
    } catch {
      toast.error('Erro ao processar imagens');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = (photoId: string) => {
    onChange(photos.filter((p) => p.id !== photoId));
  };

  const updateCaption = (photoId: string, caption: string) => {
    onChange(photos.map((p) => (p.id === photoId ? { ...p, caption } : p)));
  };

  const updateLayout = (photoId: string, layout: PhotoItem['layout']) => {
    onChange(photos.map((p) => (p.id === photoId ? { ...p, layout } : p)));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground">
          Fotos ({photos.length})
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="gap-1 text-[9px] h-5 px-1.5"
        >
          <ImagePlus className="w-3 h-3" />
          {uploading ? 'Enviando...' : '+ Fotos'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {photos.length > 0 && (
        <div className="space-y-0.5">
          {photos.map((photo) => {
            const isActive = photo.id === activePhotoId;
            return (
            <div
              key={photo.id}
              ref={isActive ? activeRowRef : undefined}
              className={cn(
                "flex items-center gap-1.5 group rounded px-1 py-0.5 transition-colors",
                isActive
                  ? "bg-primary/10 ring-1 ring-primary ring-offset-1 ring-offset-card"
                  : "hover:bg-muted/50"
              )}
            >
              <img
                src={photo.url}
                alt={photo.caption || 'Foto'}
                className="w-6 h-6 rounded object-cover shrink-0"
              />
              <Input
                value={photo.caption}
                onChange={(e) => updateCaption(photo.id, e.target.value)}
                placeholder="Legenda..."
                className="h-5 text-[9px] border-0 bg-transparent px-0 flex-1 min-w-0 focus-visible:ring-0"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 text-destructive opacity-0 group-hover:opacity-100 shrink-0"
                onClick={() => removePhoto(photo.id)}
                title="Remover"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </Button>
            </div>
            );
          })}
        </div>
      )}

      {annotatingPhoto && (
        <ImageAnnotator
          imageSrc={annotatingPhoto.url}
          open={!!annotatingPhoto}
          onOpenChange={(open) => !open && setAnnotatingPhoto(null)}
          onApply={handleAnnotationApply}
        />
      )}
    </div>
  );
}
