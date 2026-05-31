import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  X, Check, RotateCw, RotateCcw, Crop, Sun, Contrast, Droplets,
  Undo2, Redo2, ZoomIn, ZoomOut, Move, RotateCcw as ResetIcon,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ImageState {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  brightness: number;
  contrast: number;
  saturation: number;
  cropRect: { x: number; y: number; w: number; h: number } | null;
}

const DEFAULT_STATE: ImageState = {
  x: 0, y: 0, scale: 1, rotation: 0,
  brightness: 100, contrast: 100, saturation: 100,
  cropRect: null,
};

type ActiveTool = 'pan' | 'crop' | 'rotate' | 'brightness' | 'contrast' | 'saturation';

interface ServiceImageEditorProps {
  imageSrc: string;
  open: boolean;
  inline?: boolean;
  onClose: () => void;
  onApply: (dataUrl: string) => void;
}

export function ServiceImageEditor({ imageSrc, open, inline = false, onClose, onApply }: ServiceImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [state, setState] = useState<ImageState>({ ...DEFAULT_STATE });
  const [tool, setTool] = useState<ActiveTool>('pan');
  const [undoStack, setUndoStack] = useState<ImageState[]>([]);
  const [redoStack, setRedoStack] = useState<ImageState[]>([]);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  // Dragging state
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropDragging, setCropDragging] = useState(false);
  const [cropStart, setCropStart] = useState({ x: 0, y: 0 });
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [dimTooltip, setDimTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  // Load image
  useEffect(() => {
    if (!open || !imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setImgLoaded(true);
      setState({ ...DEFAULT_STATE });
      setUndoStack([]);
      setRedoStack([]);
    };
    img.src = imageSrc;
  }, [imageSrc, open]);

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-30), state]);
    setRedoStack([]);
  }, [state]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    setRedoStack(prev => [...prev, state]);
    setState(undoStack[undoStack.length - 1]);
    setUndoStack(prev => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    setUndoStack(prev => [...prev, state]);
    setState(redoStack[redoStack.length - 1]);
    setRedoStack(prev => prev.slice(0, -1));
  };

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;

    const container = containerRef.current;
    if (!container) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    canvas.width = cw;
    canvas.height = ch;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, cw, ch);

    // Background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, cw, ch);

    // Calculate fit scale
    const fitScale = Math.min((cw - 40) / img.naturalWidth, (ch - 40) / img.naturalHeight);
    const drawW = img.naturalWidth * fitScale * state.scale;
    const drawH = img.naturalHeight * fitScale * state.scale;
    const cx = cw / 2 + state.x;
    const cy = ch / 2 + state.y;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((state.rotation * Math.PI) / 180);
    ctx.filter = `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%)`;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Safe area guides
    ctx.strokeStyle = 'hsl(var(--primary) / 0.3)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    const margin = 16;
    ctx.strokeRect(margin, margin, cw - margin * 2, ch - margin * 2);
    ctx.setLineDash([]);

    // Crop overlay
    if (state.cropRect) {
      const cr = state.cropRect;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      // Top
      ctx.fillRect(0, 0, cw, cr.y);
      // Bottom
      ctx.fillRect(0, cr.y + cr.h, cw, ch - cr.y - cr.h);
      // Left
      ctx.fillRect(0, cr.y, cr.x, cr.h);
      // Right
      ctx.fillRect(cr.x + cr.w, cr.y, cw - cr.x - cr.w, cr.h);

      // Crop border
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(cr.x, cr.y, cr.w, cr.h);

      // Handles
      const handles = getCropHandles(cr);
      handles.forEach(h => {
        ctx.fillStyle = 'hsl(var(--primary))';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(h.x, h.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    // Dimension badge
    const dispW = Math.round(drawW / fitScale);
    const dispH = Math.round(drawH / fitScale);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    const badgeText = `${dispW} × ${dispH}px`;
    ctx.font = '11px monospace';
    const tw = ctx.measureText(badgeText).width;
    ctx.fillRect(cw - tw - 24, ch - 28, tw + 16, 22);
    ctx.fillStyle = '#fff';
    ctx.fillText(badgeText, cw - tw - 16, ch - 13);
  }, [state, imgLoaded]);

  useEffect(() => {
    if (imgLoaded) {
      requestAnimationFrame(draw);
    }
  }, [draw, imgLoaded]);

  // Crop handles
  function getCropHandles(cr: { x: number; y: number; w: number; h: number }) {
    return [
      { id: 'tl', x: cr.x, y: cr.y },
      { id: 'tr', x: cr.x + cr.w, y: cr.y },
      { id: 'bl', x: cr.x, y: cr.y + cr.h },
      { id: 'br', x: cr.x + cr.w, y: cr.y + cr.h },
    ];
  }

  const getCanvasPos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e);

    if (tool === 'crop' && state.cropRect) {
      // Check handles
      const handles = getCropHandles(state.cropRect);
      for (const h of handles) {
        if (Math.hypot(pos.x - h.x, pos.y - h.y) < 12) {
          setResizeHandle(h.id);
          setDragStart(pos);
          pushUndo();
          return;
        }
      }
      // Drag crop area
      const cr = state.cropRect;
      if (pos.x >= cr.x && pos.x <= cr.x + cr.w && pos.y >= cr.y && pos.y <= cr.y + cr.h) {
        setCropDragging(true);
        setDragStart(pos);
        pushUndo();
        return;
      }
    }

    if (tool === 'crop' && !state.cropRect) {
      pushUndo();
      setState(s => ({ ...s, cropRect: { x: pos.x, y: pos.y, w: 0, h: 0 } }));
      setResizeHandle('br');
      setDragStart(pos);
      return;
    }

    if (tool === 'pan') {
      setDragging(true);
      setDragStart(pos);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e);

    if (resizeHandle && state.cropRect) {
      const cr = { ...state.cropRect };
      const dx = pos.x - dragStart.x;
      const dy = pos.y - dragStart.y;

      if (resizeHandle === 'br') { cr.w += dx; cr.h += dy; }
      if (resizeHandle === 'bl') { cr.x += dx; cr.w -= dx; cr.h += dy; }
      if (resizeHandle === 'tr') { cr.w += dx; cr.y += dy; cr.h -= dy; }
      if (resizeHandle === 'tl') { cr.x += dx; cr.y += dy; cr.w -= dx; cr.h -= dy; }

      setState(s => ({ ...s, cropRect: cr }));
      setDragStart(pos);
      setDimTooltip({ x: pos.x, y: pos.y - 20, text: `${Math.abs(Math.round(cr.w))} × ${Math.abs(Math.round(cr.h))}` });
      return;
    }

    if (cropDragging && state.cropRect) {
      const dx = pos.x - dragStart.x;
      const dy = pos.y - dragStart.y;
      setState(s => ({
        ...s,
        cropRect: s.cropRect ? { ...s.cropRect, x: s.cropRect.x + dx, y: s.cropRect.y + dy } : null,
      }));
      setDragStart(pos);
      return;
    }

    if (dragging && tool === 'pan') {
      const dx = pos.x - dragStart.x;
      const dy = pos.y - dragStart.y;
      setState(s => ({ ...s, x: s.x + dx, y: s.y + dy }));
      setDragStart(pos);
    }
  };

  const handleMouseUp = () => {
    if (dragging) pushUndo();
    setDragging(false);
    setCropDragging(false);
    setResizeHandle(null);
    setDimTooltip(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setState(s => ({ ...s, scale: Math.max(0.1, Math.min(4, s.scale + delta)) }));
  };

  // Keyboard
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) { e.preventDefault(); handleRedo(); }
      if (e.key === 'Enter' && state.cropRect) { e.preventDefault(); applyCrop(); }
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, state.cropRect]);

  const rotate90 = (dir: 1 | -1) => {
    pushUndo();
    setState(s => ({ ...s, rotation: (s.rotation + dir * 90) % 360 }));
  };

  const resetAll = () => {
    pushUndo();
    setState({ ...DEFAULT_STATE });
  };

  const startCrop = () => {
    if (tool === 'crop' && state.cropRect) {
      // Cancel crop
      setState(s => ({ ...s, cropRect: null }));
      setTool('pan');
    } else {
      setTool('crop');
      // Initialize crop rect at center
      const canvas = canvasRef.current;
      if (canvas) {
        const cw = canvas.width;
        const ch = canvas.height;
        const margin = 60;
        pushUndo();
        setState(s => ({ ...s, cropRect: { x: margin, y: margin, w: cw - margin * 2, h: ch - margin * 2 } }));
      }
    }
  };

  const applyCrop = () => {
    // Crop is visual-only; the final render handles actual cropping
    setTool('pan');
  };

  // Final render to get output
  const renderOutput = (): string => {
    const img = imgRef.current;
    if (!img) return '';

    const outCanvas = document.createElement('canvas');
    let outW = img.naturalWidth;
    let outH = img.naturalHeight;

    // If cropped, calculate the crop in image-space
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      outCanvas.width = outW;
      outCanvas.height = outH;
      const ctx = outCanvas.getContext('2d')!;
      ctx.filter = `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%)`;
      ctx.save();
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate((state.rotation * Math.PI) / 180);
      ctx.drawImage(img, -outW / 2, -outH / 2, outW, outH);
      ctx.restore();
      return outCanvas.toDataURL('image/jpeg', 0.9);
    }

    const cw = canvas.width;
    const ch = canvas.height;
    const fitScale = Math.min((cw - 40) / img.naturalWidth, (ch - 40) / img.naturalHeight);

    if (state.cropRect && state.cropRect.w > 10 && state.cropRect.h > 10) {
      const cr = state.cropRect;
      // Convert crop rect from canvas space to image space
      const imgDrawW = img.naturalWidth * fitScale * state.scale;
      const imgDrawH = img.naturalHeight * fitScale * state.scale;
      const imgLeft = cw / 2 + state.x - imgDrawW / 2;
      const imgTop = ch / 2 + state.y - imgDrawH / 2;

      const scaleToImg = img.naturalWidth / imgDrawW;
      const cropX = (cr.x - imgLeft) * scaleToImg;
      const cropY = (cr.y - imgTop) * scaleToImg;
      const cropW = cr.w * scaleToImg;
      const cropH = cr.h * scaleToImg;

      outW = Math.max(1, Math.round(Math.abs(cropW)));
      outH = Math.max(1, Math.round(Math.abs(cropH)));

      outCanvas.width = outW;
      outCanvas.height = outH;
      const ctx = outCanvas.getContext('2d')!;
      ctx.filter = `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%)`;
      ctx.save();
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate((state.rotation * Math.PI) / 180);
      ctx.drawImage(img, Math.round(cropX), Math.round(cropY), outW, outH, -outW / 2, -outH / 2, outW, outH);
      ctx.restore();
    } else {
      // Handle rotation bounding box
      const rad = (state.rotation * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      outW = Math.round(img.naturalWidth * cos + img.naturalHeight * sin);
      outH = Math.round(img.naturalWidth * sin + img.naturalHeight * cos);

      outCanvas.width = outW;
      outCanvas.height = outH;
      const ctx = outCanvas.getContext('2d')!;
      ctx.filter = `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%)`;
      ctx.save();
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      ctx.restore();
    }

    return outCanvas.toDataURL('image/jpeg', 0.9);
  };

  const handleApply = () => {
    const dataUrl = renderOutput();
    if (dataUrl) onApply(dataUrl);
  };

  if (!open) return null;

  const toolItems: { id: ActiveTool; icon: typeof Move; label: string }[] = [
    { id: 'pan', icon: Move, label: 'Mover' },
    { id: 'crop', icon: Crop, label: 'Recortar' },
    { id: 'brightness', icon: Sun, label: 'Brilho' },
    { id: 'contrast', icon: Contrast, label: 'Contraste' },
    { id: 'saturation', icon: Droplets, label: 'Saturação' },
  ];

  const sliderConfig: Record<string, { min: number; max: number; key: keyof ImageState; label: string }> = {
    brightness: { min: 0, max: 200, key: 'brightness', label: 'Brilho' },
    contrast: { min: 0, max: 200, key: 'contrast', label: 'Contraste' },
    saturation: { min: 0, max: 200, key: 'saturation', label: 'Saturação' },
  };

  const activeSlider = sliderConfig[tool];
  const btnCls = cn("p-0 text-white/70 hover:text-white hover:bg-white/10", inline ? "h-5 w-5" : "h-8 w-8");
  const iconCls = inline ? "w-3 h-3" : "w-4 h-4";

  return (
    <div className={cn(
      inline
        ? 'absolute inset-0 z-20 bg-black/90 flex flex-col rounded overflow-hidden'
        : 'fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col'
    )}>
      {/* Top toolbar */}
      <div className={cn("flex items-center justify-between border-b border-white/10 shrink-0 bg-black/60", inline ? "px-1 py-0.5" : "px-3 py-2")}>
        <div className={cn("flex items-center", inline ? "gap-0" : "gap-1")}>
          <TooltipProvider delayDuration={200}>
            {/* Undo/Redo */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className={btnCls} onClick={handleUndo} disabled={undoStack.length === 0}>
                  <Undo2 className={iconCls} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>Desfazer</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className={btnCls} onClick={handleRedo} disabled={redoStack.length === 0}>
                  <Redo2 className={iconCls} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>Refazer</p></TooltipContent>
            </Tooltip>

            <div className={cn("w-px bg-white/20", inline ? "h-3 mx-0.5" : "h-5 mx-1")} />

            {/* Tools */}
            {toolItems.map(({ id, icon: Icon, label }) => (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(btnCls, tool === id && 'bg-white/20 text-white')}
                    onClick={() => id === 'crop' ? startCrop() : setTool(id)}
                  >
                    <Icon className={iconCls} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>{label}</p></TooltipContent>
              </Tooltip>
            ))}

            <div className={cn("w-px bg-white/20", inline ? "h-3 mx-0.5" : "h-5 mx-1")} />

            {/* Rotate */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className={btnCls} onClick={() => rotate90(-1)}>
                  <RotateCcw className={iconCls} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>-90°</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className={btnCls} onClick={() => rotate90(1)}>
                  <RotateCw className={iconCls} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>+90°</p></TooltipContent>
            </Tooltip>

            {/* Zoom - hide in inline mode */}
            {!inline && (
              <>
                <div className="w-px h-5 bg-white/20 mx-1" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className={btnCls} onClick={() => setState(s => ({ ...s, scale: Math.max(0.1, s.scale - 0.1) }))}>
                      <ZoomOut className={iconCls} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p>Reduzir</p></TooltipContent>
                </Tooltip>
                <span className="text-white/60 text-xs font-mono min-w-[3rem] text-center">{Math.round(state.scale * 100)}%</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className={btnCls} onClick={() => setState(s => ({ ...s, scale: Math.min(4, s.scale + 0.1) }))}>
                      <ZoomIn className={iconCls} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p>Ampliar</p></TooltipContent>
                </Tooltip>
              </>
            )}

            <div className={cn("w-px bg-white/20", inline ? "h-3 mx-0.5" : "h-5 mx-1")} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className={btnCls} onClick={resetAll}>
                  <ResetIcon className={iconCls} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>Resetar</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className={cn("flex items-center", inline ? "gap-1" : "gap-2")}>
          {tool === 'crop' && state.cropRect && (
            <Button size="sm" className={cn("gap-1 text-xs", inline ? "h-5 text-[10px]" : "h-7")} onClick={applyCrop}>
              <Check className={cn(inline ? "w-2.5 h-2.5" : "w-3 h-3")} /> Corte
            </Button>
          )}
          <Button variant="ghost" size="sm" className={cn("text-white/70 hover:text-white hover:bg-white/10 gap-1", inline ? "h-5 px-1" : "h-8")} onClick={onClose}>
            <X className={iconCls} />
          </Button>
          <Button size="sm" className={cn("gap-1", inline ? "h-5 px-1.5 text-[10px]" : "h-8")} onClick={handleApply}>
            <Check className={iconCls} /> <span className="text-xs">OK</span>
          </Button>
        </div>
      </div>

      {/* Adjustment slider */}
      {activeSlider && (
        <div className={cn("flex items-center bg-black/40 shrink-0", inline ? "gap-1 px-1 py-0.5" : "gap-3 px-4 py-2")}>
          <span className="text-white/60 text-xs min-w-[60px]">{activeSlider.label}</span>
          <Slider
            value={[state[activeSlider.key] as number]}
            min={activeSlider.min}
            max={activeSlider.max}
            step={1}
            onValueChange={([v]) => {
              setState(s => ({ ...s, [activeSlider.key]: v }));
            }}
            onValueCommit={() => pushUndo()}
            className="flex-1 max-w-xs"
          />
          <span className="text-white/60 text-xs font-mono min-w-[3rem] text-right">{state[activeSlider.key] as number}%</span>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-white/50 hover:text-white" onClick={() => { pushUndo(); setState(s => ({ ...s, [activeSlider.key]: 100 })); }}>
            Reset
          </Button>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className={cn(
          'flex-1 relative overflow-hidden',
          tool === 'pan' && !dragging && 'cursor-grab',
          tool === 'pan' && dragging && 'cursor-grabbing',
          tool === 'crop' && 'cursor-crosshair',
        )}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />
        {dimTooltip && (
          <div
            className="absolute bg-foreground/80 text-background text-xs px-2 py-1 rounded-md shadow-lg font-mono pointer-events-none"
            style={{ left: dimTooltip.x + 10, top: dimTooltip.y }}
          >
            {dimTooltip.text}
          </div>
        )}
      </div>
    </div>
  );
}
