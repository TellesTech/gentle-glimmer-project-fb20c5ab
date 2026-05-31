import { useState, useRef, useEffect, useCallback } from "react";
import { Pencil, Undo2, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ImageAnnotatorProps {
  imageSrc: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (annotatedImageDataUrl: string) => void;
}

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  lineWidth: number;
}

const COLORS = [
  { name: "Vermelho", value: "#ef4444" },
  { name: "Amarelo", value: "#eab308" },
  { name: "Verde", value: "#22c55e" },
  { name: "Azul", value: "#3b82f6" },
  { name: "Preto", value: "#000000" },
  { name: "Branco", value: "#ffffff" },
];

export function ImageAnnotator({
  imageSrc,
  open,
  onOpenChange,
  onApply,
}: ImageAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#ef4444");
  const [lineWidth, setLineWidth] = useState(4);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Load image when dialog opens
  useEffect(() => {
    if (!open || !imageSrc) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImage(img);
      // Calculate canvas size to fit the container
      const maxWidth = Math.min(800, window.innerWidth - 80);
      const maxHeight = Math.min(500, window.innerHeight - 300);
      
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        const ratio = maxWidth / width;
        width = maxWidth;
        height = height * ratio;
      }
      if (height > maxHeight) {
        const ratio = maxHeight / height;
        height = maxHeight;
        width = width * ratio;
      }
      
      setCanvasSize({ width, height });
    };
    img.src = imageSrc;
  }, [imageSrc, open]);

  // Draw image and strokes
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !image) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Draw all strokes
    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;
    allStrokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;

      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });
  }, [image, strokes, currentStroke]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const point = getCanvasPoint(e);
    setIsDrawing(true);
    setCurrentStroke({
      points: [point],
      color,
      lineWidth,
    });
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentStroke) return;
    e.preventDefault();

    const point = getCanvasPoint(e);
    setCurrentStroke((prev) =>
      prev ? { ...prev, points: [...prev.points, point] } : null
    );
  };

  const stopDrawing = () => {
    if (isDrawing && currentStroke && currentStroke.points.length > 1) {
      setStrokes((prev) => [...prev, currentStroke]);
    }
    setIsDrawing(false);
    setCurrentStroke(null);
  };

  const handleUndo = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setStrokes([]);
  };

  const handleApply = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Generate data URL with annotations
    const dataUrl = canvas.toDataURL("image/png");
    onApply(dataUrl);
    onOpenChange(false);
    
    // Reset state
    setStrokes([]);
    setCurrentStroke(null);
  };

  const handleCancel = () => {
    onOpenChange(false);
    setStrokes([]);
    setCurrentStroke(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Adicionar Marcações
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Canvas Container */}
          <div
            ref={containerRef}
            className="relative border rounded-lg overflow-hidden bg-muted/30 flex items-center justify-center"
            style={{ minHeight: 200 }}
          >
            {canvasSize.width > 0 && (
              <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                className="cursor-crosshair touch-none"
                style={{
                  maxWidth: "100%",
                  height: "auto",
                }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            )}
          </div>

          {/* Controls */}
          <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
            {/* Color Picker */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Cor do Lápis</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                      color === c.value
                        ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "border-muted-foreground/30"
                    )}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            {/* Line Width */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Espessura do Traço: {lineWidth}px
              </Label>
              <Slider
                value={[lineWidth]}
                onValueChange={(v) => setLineWidth(v[0])}
                min={2}
                max={12}
                step={1}
                className="w-full max-w-xs"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUndo}
                disabled={strokes.length === 0}
                className="gap-1"
              >
                <Undo2 className="h-4 w-4" />
                Desfazer
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={strokes.length === 0}
                className="gap-1"
              >
                <Trash2 className="h-4 w-4" />
                Limpar Tudo
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            <X className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
          <Button type="button" onClick={handleApply}>
            <Check className="h-4 w-4 mr-1" />
            Aplicar Marcações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
