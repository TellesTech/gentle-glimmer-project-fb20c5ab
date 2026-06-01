import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn, Loader2, AlertCircle } from "lucide-react";
import type { Photo } from "@/types";
import { cn } from "@/lib/utils";
import { useStorageUpload } from "@/hooks/useStorageUpload";

interface PhotoGalleryProps {
  photos: Photo[];
  className?: string;
}

export function PhotoGallery({ photos, className }: PhotoGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState(true);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({});
  const { getViewUrl } = useStorageUpload();

  // Touch/swipe state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);

  const minSwipeDistance = 50;

  // Generate signed URLs for storage photos with timeout
  useEffect(() => {
    if (photos.length === 0) {
      setLoadingUrls(false);
      return;
    }

    let isCancelled = false;
    const TIMEOUT_MS = 10000;

    const loadSignedUrls = async () => {
      setLoadingUrls(true);
      const urls: Record<string, string> = {};

      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
      );

      const loadUrlsPromise = Promise.all(
        photos.map(async (photo) => {
          if (!photo?.id || !photo?.url) {
            console.warn('Photo missing id or url:', photo);
            return;
          }

          try {
            const needsSignedUrl = 
              !photo.url.startsWith('http') ||
              ((photo.url.includes('supabase') || photo.url.includes('/storage/')) &&
                !photo.url.includes('/storage/v1/object/public/'));

            if (needsSignedUrl) {
              const signedUrl = await getViewUrl(photo.url);
              if (!isCancelled && signedUrl) {
                urls[photo.id] = signedUrl;
              }
            } else {
              urls[photo.id] = photo.url;
            }
          } catch (error) {
            console.error('Error generating signed URL:', photo.id, error);
            urls[photo.id] = photo.url;
          }
        })
      );

      try {
        await Promise.race([loadUrlsPromise, timeoutPromise]);
      } catch (error) {
        console.warn('Photo loading timeout or error, using original URLs');
        photos.forEach(photo => {
          if (photo?.id && photo?.url && !urls[photo.id]) {
            urls[photo.id] = photo.url;
          }
        });
      }

      if (!isCancelled) {
        setSignedUrls(urls);
        setLoadingUrls(false);
      }
    };

    loadSignedUrls();

    return () => {
      isCancelled = true;
    };
  }, [photos, getViewUrl]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [lightboxOpen]);

  // Preload adjacent images when lightbox is open
  useEffect(() => {
    if (lightboxOpen && photos.length > 1) {
      const nextIndex = (currentIndex + 1) % photos.length;
      const prevIndex = (currentIndex - 1 + photos.length) % photos.length;
      
      const preloadNext = new Image();
      preloadNext.src = getPhotoUrl(photos[nextIndex]);
      
      const preloadPrev = new Image();
      preloadPrev.src = getPhotoUrl(photos[prevIndex]);
    }
  }, [currentIndex, lightboxOpen, photos]);

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goToPrevious();
      if (e.key === "ArrowRight") goToNext();
      if (e.key === "Escape") setLightboxOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen]);

  const getPhotoUrl = useCallback((photo: Photo): string => {
    if (!photo?.id) return '';
    return signedUrls[photo.id] || photo.url || '';
  }, [signedUrls]);

  const handleImageError = (photoId: string) => {
    setImageErrors((prev) => ({ ...prev, [photoId]: true }));
    setImageLoading((prev) => ({ ...prev, [photoId]: false }));
  };

  const handleImageLoad = (photoId: string) => {
    setImageLoading((prev) => ({ ...prev, [photoId]: false }));
    setImageErrors((prev) => ({ ...prev, [photoId]: false }));
  };

  const openLightbox = (index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  }, [photos.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  }, [photos.length]);

  // Touch handlers for swipe
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && photos.length > 1) {
      goToNext();
    }
    if (isRightSwipe && photos.length > 1) {
      goToPrevious();
    }
  };

  if (photos.length === 0) return null;

  if (loadingUrls) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando fotos...</span>
      </div>
    );
  }

  const currentPhoto = photos[currentIndex];

  return (
    <>
      {/* Grid Gallery - 2 columns on mobile */}
      <div className={cn("grid grid-cols-2 gap-3", className)}>
        {photos.map((photo, index) => (
          <button
            key={photo.id || index}
            onClick={() => openLightbox(index)}
            className="relative group aspect-square rounded-lg overflow-hidden bg-muted touch-manipulation"
            style={{ minHeight: '120px' }}
          >
            {/* Loading State */}
            {imageLoading[photo.id] && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Error State */}
            {imageErrors[photo.id] && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted text-muted-foreground z-10">
                <AlertCircle className="w-8 h-8 mb-2" />
                <span className="text-xs">Erro ao carregar</span>
              </div>
            )}

            {/* Image with explicit dimensions */}
            {!imageErrors[photo.id] && (
              <img
                src={getPhotoUrl(photo)}
                alt={photo.description || `Foto ${index + 1}`}
                width={200}
                height={200}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                onLoad={() => handleImageLoad(photo.id)}
                onError={() => handleImageError(photo.id)}
                loading="lazy"
                decoding="async"
              />
            )}

            {/* Hover/Touch Overlay */}
            {!imageErrors[photo.id] && !imageLoading[photo.id] && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 active:bg-black/30 transition-colors flex items-center justify-center">
                <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity" />
              </div>
            )}

            {/* Description */}
            {photo.description && !imageErrors[photo.id] && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <p className="text-xs text-white truncate">{photo.description}</p>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Mobile-First Fullscreen Lightbox */}
      {lightboxOpen && (
        <div
          ref={lightboxRef}
          className="fixed inset-0 z-[100] bg-black flex flex-col lightbox-safe-area"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          role="dialog"
          aria-modal="true"
          aria-label="Visualizador de fotos"
        >
          {/* Header with close button - large touch target */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-20">
            <span className="text-white text-sm font-medium">
              {currentIndex + 1} de {photos.length}
            </span>
            <button
              onClick={closeLightbox}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-colors touch-manipulation"
              aria-label="Fechar visualizador"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Main Image Area with pinch-to-zoom support */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            {/* Invisible touch areas for navigation (1/3 of screen each side) */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={goToPrevious}
                  className="absolute inset-y-0 left-0 w-1/4 z-10 touch-manipulation"
                  aria-label="Foto anterior"
                />
                <button
                  onClick={goToNext}
                  className="absolute inset-y-0 right-0 w-1/4 z-10 touch-manipulation"
                  aria-label="Próxima foto"
                />
              </>
            )}

            {/* Image with pinch-to-zoom */}
            <div className="w-full h-full flex items-center justify-center p-4 lightbox-image-container">
              {imageErrors[currentPhoto?.id] ? (
                <div className="flex flex-col items-center text-white">
                  <AlertCircle className="w-16 h-16 mb-4" />
                  <p>Erro ao carregar a imagem</p>
                </div>
              ) : (
                <img
                  src={getPhotoUrl(currentPhoto)}
                  alt={currentPhoto?.description || `Foto ${currentIndex + 1}`}
                  className="max-w-full max-h-full object-contain select-none"
                  style={{ touchAction: 'pinch-zoom' }}
                  onLoad={() => handleImageLoad(currentPhoto?.id)}
                  onError={() => handleImageError(currentPhoto?.id)}
                  draggable={false}
                />
              )}
            </div>

            {/* Visible Navigation Arrows (desktop & larger touch targets) */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={goToPrevious}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 active:bg-black/80 text-white transition-colors z-20 touch-manipulation hidden sm:flex"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button
                  onClick={goToNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 active:bg-black/80 text-white transition-colors z-20 touch-manipulation hidden sm:flex"
                  aria-label="Próxima foto"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </>
            )}
          </div>

          {/* Footer with description and thumbnails */}
          <div className="bg-gradient-to-t from-black/90 to-transparent pt-8 pb-4 px-4">
            {/* Description */}
            {currentPhoto?.description && (
              <p className="text-white text-center text-sm mb-4 px-4">
                {currentPhoto.description}
              </p>
            )}

            {/* Thumbnail navigation */}
            {photos.length > 1 && (
              <div className="flex justify-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {photos.map((photo, index) => (
                  <button
                    key={photo.id || index}
                    onClick={() => setCurrentIndex(index)}
                    className={cn(
                      "w-14 h-14 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 touch-manipulation",
                      index === currentIndex
                        ? "border-white scale-110"
                        : "border-transparent opacity-50 hover:opacity-80 active:opacity-100"
                    )}
                  >
                    {imageErrors[photo.id] ? (
                      <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                        <AlertCircle className="w-4 h-4 text-neutral-500" />
                      </div>
                    ) : (
                      <img
                        src={getPhotoUrl(photo)}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={() => handleImageError(photo.id)}
                        loading="lazy"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Swipe hint for mobile */}
            {photos.length > 1 && (
              <p className="text-white/50 text-xs text-center mt-2 sm:hidden">
                Deslize para navegar
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
