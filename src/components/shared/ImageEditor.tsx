import { useState, useCallback, useRef, useEffect, forwardRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Check, X, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ImageEditorProps {
  imageSrc: string;
  onApply: (editedImage: string) => void;
  onCancel: () => void;
  cropWidth?: number;
  cropHeight?: number;
  quality?: number;
  circular?: boolean;
}

interface EditorState {
  scale: number;
  positionX: number;
  positionY: number;
}

const MIN_DISPLAY_SIZE = 200;

function isPngImage(src: string): boolean {
  return src.includes('image/png') || 
         src.toLowerCase().endsWith('.png') ||
         src.includes('data:image/png');
}

function drawCheckerboard(
  ctx: CanvasRenderingContext2D, 
  width: number, 
  height: number, 
  squareSize: number = 10
) {
  const lightColor = '#f0f0f0';
  const darkColor = '#d0d0d0';
  for (let y = 0; y < height; y += squareSize) {
    for (let x = 0; x < width; x += squareSize) {
      const isEvenRow = Math.floor(y / squareSize) % 2 === 0;
      const isEvenCol = Math.floor(x / squareSize) % 2 === 0;
      ctx.fillStyle = (isEvenRow === isEvenCol) ? lightColor : darkColor;
      ctx.fillRect(x, y, squareSize, squareSize);
    }
  }
}

export const ImageEditor = forwardRef<HTMLDivElement, ImageEditorProps>(({
  imageSrc,
  onApply,
  onCancel,
  cropWidth = 300,
  cropHeight = 200,
  quality = 0.9,
  circular = false,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  const [editorState, setEditorState] = useState<EditorState>({
    scale: 1,
    positionX: 0,
    positionY: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isPng, setIsPng] = useState(false);

  // Calculate display dimensions (scale up if crop is too small)
  const displayScale = Math.max(
    MIN_DISPLAY_SIZE / cropWidth,
    MIN_DISPLAY_SIZE / cropHeight,
    1
  );
  const displayWidth = Math.round(cropWidth * displayScale);
  const displayHeight = Math.round(cropHeight * displayScale);

  // Load image
  useEffect(() => {
    const isPngImg = isPngImage(imageSrc);
    setIsPng(isPngImg);
    
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
      
      const scaleToFit = Math.max(
        displayWidth / img.width,
        displayHeight / img.height
      ) * 1.2;
      
      setEditorState({
        scale: Math.max(0.3, Math.min(scaleToFit, 3)),
        positionX: 0,
        positionY: 0,
      });
    };
    img.onerror = () => {
      toast.error('Erro ao carregar imagem no editor');
    };
    img.src = imageSrc;
  }, [imageSrc, displayWidth, displayHeight]);

  // Draw preview on the display-sized canvas
  useEffect(() => {
    if (!canvasRef.current || !imageRef.current || !imageLoaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageRef.current;
    const { scale, positionX, positionY } = editorState;

    ctx.clearRect(0, 0, displayWidth, displayHeight);

    if (isPng) {
      drawCheckerboard(ctx, displayWidth, displayHeight, 8);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, displayWidth, displayHeight);
    }

    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const x = (displayWidth - scaledWidth) / 2 + positionX;
    const y = (displayHeight - scaledHeight) / 2 + positionY;

    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
  }, [editorState, imageLoaded, displayWidth, displayHeight, isPng]);

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setDragStart({
      x: clientX - editorState.positionX,
      y: clientY - editorState.positionY,
    });
  }, [editorState.positionX, editorState.positionY]);

  const handleMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    e.stopPropagation();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    setEditorState(prev => ({
      ...prev,
      positionX: clientX - dragStart.x,
      positionY: clientY - dragStart.y,
    }));
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleZoomChange = useCallback((value: number[]) => {
    setEditorState(prev => ({ ...prev, scale: value[0] }));
  }, []);

  const handleZoomIn = useCallback(() => {
    setEditorState(prev => ({ ...prev, scale: Math.min(prev.scale + 0.05, 4) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setEditorState(prev => ({ ...prev, scale: Math.max(prev.scale - 0.05, 0.1) }));
  }, []);

  const handleReset = useCallback(() => {
    if (!imageRef.current) return;
    const img = imageRef.current;
    const scaleToFit = Math.max(
      displayWidth / img.width,
      displayHeight / img.height
    ) * 1.2;
    setEditorState({
      scale: Math.max(0.3, Math.min(scaleToFit, 3)),
      positionX: 0,
      positionY: 0,
    });
  }, [displayWidth, displayHeight]);

  const handleApply = useCallback(() => {
    if (!canvasRef.current || !imageRef.current) {
      toast.error('Erro: imagem não carregada');
      return;
    }
    
    // Output canvas at the REAL crop dimensions
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = cropWidth;
    outputCanvas.height = cropHeight;
    
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) {
      toast.error('Erro ao processar imagem');
      return;
    }

    const img = imageRef.current;
    const { scale, positionX, positionY } = editorState;

    if (!isPng) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cropWidth, cropHeight);
    }

    // Scale positions from display space back to output space
    const invScale = 1 / displayScale;
    const scaledWidth = img.width * scale * invScale;
    const scaledHeight = img.height * scale * invScale;
    const x = (cropWidth - scaledWidth) / 2 + positionX * invScale;
    const y = (cropHeight - scaledHeight) / 2 + positionY * invScale;

    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

    const outputFormat = isPng ? 'image/png' : 'image/jpeg';
    const outputQuality = isPng ? undefined : quality;
    
    const editedImage = outputCanvas.toDataURL(outputFormat, outputQuality);
    onApply(editedImage);
  }, [editorState, cropWidth, cropHeight, displayScale, quality, onApply, isPng]);

  return (
    <div ref={ref} className="space-y-4">
      {/* Canvas Preview Area */}
      <div 
        ref={containerRef}
        className={cn(
          "relative mx-auto overflow-hidden border-2 border-dashed border-primary/50",
          circular ? "rounded-full" : "rounded-lg"
        )}
        style={{ 
          width: displayWidth, 
          height: displayHeight,
          clipPath: circular ? 'circle(50%)' : undefined,
          background: isPng 
            ? 'repeating-conic-gradient(#d0d0d0 0% 25%, #f0f0f0 0% 50%) 50% / 16px 16px'
            : 'hsl(var(--muted) / 0.3)'
        }}
      >
        <canvas
          ref={canvasRef}
          width={displayWidth}
          height={displayHeight}
          className={cn(
            "cursor-move touch-none",
            isDragging && "cursor-grabbing"
          )}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        />
        
        {imageLoaded && !isDragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
              <Move className="inline h-3 w-3 mr-1" />
              Arraste para posicionar
            </div>
          </div>
        )}

        {isPng && (
          <div className="absolute top-2 right-2 rounded bg-green-500/90 px-2 py-0.5 text-[10px] font-medium text-white">
            PNG Transparente
          </div>
        )}

        {displayScale > 1 && (
          <div className="absolute bottom-2 left-2 rounded bg-muted/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Saída: {cropWidth}×{cropHeight}px
          </div>
        )}
      </div>

      {/* Zoom Control */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium tabular-nums">
            Zoom: {Math.round(editorState.scale * 100)}%
          </span>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
        <Slider
          value={[editorState.scale]}
          onValueChange={handleZoomChange}
          min={0.1}
          max={4}
          step={0.01}
          className="w-full"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleReset} className="flex-1">
          <RotateCcw className="mr-1 h-3 w-3" />
          Reset
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} className="flex-1">
          <X className="mr-1 h-3 w-3" />
          Cancelar
        </Button>
        <Button type="button" variant="default" size="sm" onClick={handleApply} className="flex-1">
          <Check className="mr-1 h-3 w-3" />
          Aplicar
        </Button>
      </div>
    </div>
  );
});

ImageEditor.displayName = 'ImageEditor';
