import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ImagePlus, X, Pencil, GripVertical, Maximize2, Minimize2, Globe, MapPin, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
export type CanvasTool = 'cursor' | 'text' | 'pencil' | 'circle' | 'rect' | 'arrow' | 'image';
import type { ContentBlock } from './SectionEditor';
import type { PhotoItem } from './PhotoBlockEditor';
import { RichTextBlock } from './editor/RichTextBlock';
import type { Editor } from '@tiptap/react';
import React from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { getSectionNumberPrefix, formatSectionTitle } from '@/lib/sectionNumbering';
import irataBrasilLogoFixed from '@/assets/irata-brasil.png';
import irataInternationalLogoFixed from '@/assets/irata-international.png';

/** Module-level stable component to avoid remount on parent re-render */
const StableEditableText = React.memo(function StableEditableText({
  text, className, onBlur, isTextEditable, setActiveEditor,
}: {
  text: string; className?: string; onBlur: (v: string) => void;
  isTextEditable: boolean; setActiveEditor: (e: Editor | null) => void;
}) {
  if (!isTextEditable) return <span className={className}>{text}</span>;
  return (
    <RichTextBlock
      content={text}
      // Live edits are intentionally ignored to avoid mid-typing re-pagination.
      onChange={() => { /* no-op — we commit on blur */ }}
      onCommit={(val) => onBlur(val)}
      onFocus={(editor) => setActiveEditor(editor)}
      variant="inline"
      className={className}
      editable={isTextEditable}
      placeholder="Editar..."
    />
  );
});

/** Logo for the cover page — invertida sobre o vermelho */
function CoverLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { settings } = useSystemSettings();
  const logoUrl = settings?.pdf_logo_url || settings?.logo_url;
  const heightClass = size === 'sm' ? 'h-8' : 'h-12';
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="WEES"
        className={cn(heightClass, 'w-auto object-contain')}
        style={{ filter: 'brightness(0) invert(1)' }}
      />
    );
  }
  return (
    <div className="px-3 py-1.5 border border-white/60 rounded">
      <span className="text-white text-lg font-bold tracking-[0.18em]">WEES</span>
    </div>
  );
}

/** Slot for IRATA logo — usa upload customizado ou asset fixo embutido */
function IrataLogoSlot({ url, fallbackSrc, label }: { url?: string | null; fallbackSrc: string; label: string }) {
  const src = url || fallbackSrc;
  return (
    <div className="h-[44px] w-[44px] flex items-center justify-center">
      <img
        src={src}
        alt={label}
        className="max-w-full max-h-full object-contain"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
      />
    </div>
  );
}

/** Editorial photo mosaic — assimétrico tipo "magazine", 1 a 4 fotos */
function PhotoMosaic({ photos }: { photos: string[] }) {
  if (photos.length === 0) return null;

  const imgClass = 'w-full h-full object-cover';
  const tileClass = 'overflow-hidden rounded shadow-[0_8px_24px_-8px_rgba(0,0,0,0.25)]';

  if (photos.length === 1) {
    return (
      <div className={cn(tileClass, 'w-full h-full')}>
        <img src={photos[0]} alt="Foto 1" className={imgClass} />
      </div>
    );
  }

  if (photos.length === 2) {
    return (
      <div className="w-full h-full flex flex-col gap-3">
        <div className={cn(tileClass, 'flex-[3]')}>
          <img src={photos[0]} alt="Foto 1" className={imgClass} />
        </div>
        <div className={cn(tileClass, 'flex-[2]')}>
          <img src={photos[1]} alt="Foto 2" className={imgClass} />
        </div>
      </div>
    );
  }

  if (photos.length === 3) {
    return (
      <div className="w-full h-full flex gap-3">
        <div className={cn(tileClass, 'flex-[3] h-full')}>
          <img src={photos[0]} alt="Foto 1" className={imgClass} />
        </div>
        <div className="flex-[2] flex flex-col gap-3">
          <div className={cn(tileClass, 'flex-1')}>
            <img src={photos[1]} alt="Foto 2" className={imgClass} />
          </div>
          <div className={cn(tileClass, 'flex-1')}>
            <img src={photos[2]} alt="Foto 3" className={imgClass} />
          </div>
        </div>
      </div>
    );
  }

  // 4 photos — grid 2x2
  return (
    <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-3">
      {photos.slice(0, 4).map((url, i) => (
        <div key={i} className={tileClass}>
          <img src={url} alt={`Foto ${i + 1}`} className={imgClass} />
        </div>
      ))}
    </div>
  );
}

interface Point { x: number; y: number; }

export interface Annotation {
  id: string;
  type: 'stroke' | 'circle' | 'rect' | 'arrow' | 'text';
  points: Point[];
  color: string;
  lineWidth: number;
  text?: string;
  width?: number;
  height?: number;
}

interface Section {
  id: string;
  title: string;
  sectionType: string;
  content: ContentBlock[];
  photos: PhotoItem[];
  annotations?: Annotation[];
}

/** Estimate available height for photos on a page and split into slices */
export function paginateSectionPhotos(
  photos: PhotoItem[],
  hasTextContent: boolean,
): PhotoItem[][] {
  if (photos.length === 0) return [[]];

  // Estimated available height for photos (in px, relative to ~740px page height)
  const FIRST_PAGE_PHOTO_BUDGET = hasTextContent ? 420 : 560;
  const CONTINUATION_BUDGET = 620;
  const ROW_GAP = 4;

  const estimateRowHeight = (photo: PhotoItem) => {
    const h = photo.customHeight ?? 160;
    return h + 18 + ROW_GAP; // photo + caption + gap
  };

  const slices: PhotoItem[][] = [];
  let current: PhotoItem[] = [];
  let usedHeight = 0;
  let budget = FIRST_PAGE_PHOTO_BUDGET;

  let i = 0;
  while (i < photos.length) {
    const photo = photos[i];
    const widthPct = photo.widthPercent ?? (photo.layout === 'full' ? 100 : 50);
    // Group side-by-side photos (both ≤50%) as one row
    let rowH = estimateRowHeight(photo);
    let consumed = 1;
    if (widthPct <= 50 && i + 1 < photos.length) {
      const next = photos[i + 1];
      const nextW = next.widthPercent ?? (next.layout === 'full' ? 100 : 50);
      if (nextW <= 50) {
        rowH = Math.max(rowH, estimateRowHeight(next));
        consumed = 2;
      }
    }
    if (current.length > 0 && usedHeight + rowH > budget) {
      slices.push(current);
      current = [];
      usedHeight = 0;
      budget = CONTINUATION_BUDGET;
    }
    for (let j = 0; j < consumed && i + j < photos.length; j++) {
      current.push(photos[i + j]);
    }
    usedHeight += rowH;
    i += consumed;
  }
  if (current.length > 0) slices.push(current);

  return slices.length > 0 ? slices : [[]];
}

export interface PageSlot {
  section: { id: string; title: string; sectionType: string; content: { id: string; type: 'paragraph' | 'heading' | 'list'; text: string }[]; photos: PhotoItem[]; annotations?: Annotation[] };
  sectionIndex: number;
  photosSlice: PhotoItem[];
  isContinuation: boolean;
  showText: boolean;
}

export function paginateAllSections(sections: { id: string; title: string; sectionType: string; content: { id: string; type: string; text: string }[]; photos: PhotoItem[]; annotations?: Annotation[] }[]): PageSlot[][] {
  if (sections.length === 0) return [];

  const TOTAL_BUDGET = 560;
  const SECTION_GAP = 16;
  const TITLE_H = 20;
  const ROW_GAP = 4;

  const estimateTextH = (sec: typeof sections[number]): number => {
    let h = TITLE_H;
    for (const block of sec.content) {
      const text = block.text.replace(/<[^>]*>/g, '');
      if (block.type === 'heading') h += 16;
      else if (block.type === 'paragraph') {
        h += Math.max(1, Math.ceil(text.length / 60)) * 14;
      } else {
        h += Math.max(1, text.split('\n').filter(Boolean).length) * 12;
      }
    }
    return h + 24; // +24 for photo upload button area
  };

  // Clamp da estimativa: uma única linha de foto nunca pode exceder o orçamento
  // total de uma página fresca, ou a foto seria descartada pela paginação
  // (era a causa real de fotos sumirem do preview mesmo aparecendo no PDF).
  const MAX_ROW_H = TOTAL_BUDGET - TITLE_H - 4;
  const estimatePhotoRowH = (photo: PhotoItem) =>
    Math.min(MAX_ROW_H, (photo.customHeight ?? 160) + 24 + ROW_GAP);

  const estimatePhotosH = (photos: PhotoItem[]): number => {
    let h = 0, i = 0;
    while (i < photos.length) {
      const p = photos[i];
      const w = p.widthPercent ?? (p.layout === 'full' ? 100 : 50);
      let rowH = estimatePhotoRowH(p);
      let consumed = 1;
      if (w <= 50 && i + 1 < photos.length) {
        const next = photos[i + 1];
        const nw = next.widthPercent ?? (next.layout === 'full' ? 100 : 50);
        if (nw <= 50) { rowH = Math.max(rowH, estimatePhotoRowH(next)); consumed = 2; }
      }
      h += rowH;
      i += consumed;
    }
    return h;
  };

  const splitPhotos = (photos: PhotoItem[], budget: number): [PhotoItem[], PhotoItem[]] => {
    let used = 0, i = 0;
    while (i < photos.length) {
      const p = photos[i];
      const w = p.widthPercent ?? (p.layout === 'full' ? 100 : 50);
      let rowH = estimatePhotoRowH(p);
      let consumed = 1;
      if (w <= 50 && i + 1 < photos.length) {
        const next = photos[i + 1];
        const nw = next.widthPercent ?? (next.layout === 'full' ? 100 : 50);
        if (nw <= 50) { rowH = Math.max(rowH, estimatePhotoRowH(next)); consumed = 2; }
      }
      if (used + rowH > budget) {
        // Garante progresso: se nem a primeira foto cabe no orçamento atual,
        // força a entrada dela aqui (em vez de descartar silenciosamente).
        // Quando i === 0 e budget é pequeno, devolve-se vazio para que o
        // chamador faça flush e tente em página fresca; lá MAX_ROW_H garante
        // que sempre caberá.
        if (i === 0 && budget >= MAX_ROW_H) {
          used = budget;
          i += consumed;
        }
        break;
      }
      used += rowH;
      i += consumed;
    }
    return [photos.slice(0, i), photos.slice(i)];
  };

  const pages: PageSlot[][] = [];
  let currentPage: PageSlot[] = [];
  let remaining = TOTAL_BUDGET;

  const flushPage = () => {
    if (currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      remaining = TOTAL_BUDGET;
    }
  };

  const addPhotoContinuations = (sec: typeof sections[number], sIdx: number, photos: PhotoItem[]) => {
    let leftover = photos;
    while (leftover.length > 0) {
      const contBudget = remaining - TITLE_H;
      const effectiveBudget = contBudget > 60 ? contBudget : TOTAL_BUDGET - TITLE_H;
      if (contBudget <= 60) flushPage();
      const [fit, rest] = splitPhotos(leftover, effectiveBudget);
      if (fit.length === 0) {
        // Fallback de segurança: se mesmo em página fresca não couber nada
        // (foto patologicamente alta), forçamos a primeira foto sozinha
        // para não perdê-la. MAX_ROW_H garante que isso quase nunca ocorre.
        if (remaining >= TOTAL_BUDGET - TITLE_H) {
          currentPage.push({
            section: sec as any, sectionIndex: sIdx,
            photosSlice: [leftover[0]],
            isContinuation: true, showText: false,
          });
          leftover = leftover.slice(1);
          flushPage();
          continue;
        }
        flushPage();
        continue;
      }
      currentPage.push({
        section: sec as any, sectionIndex: sIdx,
        photosSlice: fit,
        isContinuation: true, showText: false,
      });
      remaining -= estimatePhotosH(fit) + TITLE_H;
      leftover = rest;
      if (leftover.length > 0) flushPage();
    }
  };

  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    const section = sections[sIdx];
    const textH = estimateTextH(section);
    const photosH = estimatePhotosH(section.photos);
    const totalH = textH + photosH;
    const gapH = currentPage.length > 0 ? SECTION_GAP : 0;

    if (totalH + gapH <= remaining) {
      currentPage.push({
        section: section as any, sectionIndex: sIdx,
        photosSlice: section.photos,
        isContinuation: false, showText: true,
      });
      remaining -= totalH + gapH;
    } else if (textH + gapH <= remaining) {
      const photoBudget = remaining - textH - gapH;
      // If not enough room for even one photo row, move entire section to new page
      if (photoBudget < 80 && section.photos.length > 0) {
        flushPage();
        if (totalH <= TOTAL_BUDGET) {
          currentPage.push({
            section: section as any, sectionIndex: sIdx,
            photosSlice: section.photos,
            isContinuation: false, showText: true,
          });
          remaining -= totalH;
        } else {
          const newBudget = TOTAL_BUDGET - textH;
          const [fit2, rest2] = splitPhotos(section.photos, newBudget);
          currentPage.push({
            section: section as any, sectionIndex: sIdx,
            photosSlice: fit2,
            isContinuation: false, showText: true,
          });
          if (rest2.length > 0) {
            flushPage();
            addPhotoContinuations(section, sIdx, rest2);
          } else {
            remaining -= totalH;
          }
        }
      } else {
        const [fit, rest] = splitPhotos(section.photos, photoBudget);
        currentPage.push({
          section: section as any, sectionIndex: sIdx,
          photosSlice: fit,
          isContinuation: false, showText: true,
        });
        if (rest.length > 0) {
          flushPage();
          addPhotoContinuations(section, sIdx, rest);
        } else {
          remaining -= totalH + gapH;
        }
      }
    } else {
      flushPage();
      if (totalH <= TOTAL_BUDGET) {
        currentPage.push({
          section: section as any, sectionIndex: sIdx,
          photosSlice: section.photos,
          isContinuation: false, showText: true,
        });
        remaining -= totalH;
      } else {
        const photoBudget = TOTAL_BUDGET - textH;
        const [fit, rest] = splitPhotos(section.photos, photoBudget);
        currentPage.push({
          section: section as any, sectionIndex: sIdx,
          photosSlice: fit,
          isContinuation: false, showText: true,
        });
        if (rest.length > 0) {
          flushPage();
          addPhotoContinuations(section, sIdx, rest);
        } else {
          remaining -= totalH;
        }
      }
    }
  }

  flushPage();
  return pages;
}


interface InteractivePdfPageProps {
  onEditorChange?: (editor: Editor | null) => void;
  type: 'cover' | 'section';
  title?: string;
  clientName?: string;
  clientUnit?: string;
  code?: string;
  revision?: number;
  startDate?: string;
  endDate?: string;
  coverImageUrl?: string | null;
  coverPhotos?: string[];
  showIrataSeals?: boolean;
  irataLogoBrasilUrl?: string | null;
  irataLogoInternationalUrl?: string | null;
  section?: Section;
  sectionIndex?: number;
  activeTool?: CanvasTool;
  color?: string;
  lineWidth?: number;
  zoom?: number;
  selectedSectionId: string | null;
  activePhotoId?: string | null;
  onSelectSection: (id: string | null) => void;
  onTitleEdit?: (value: string) => void;
  onBlockEdit?: (sectionId: string, blockId: string, text: string) => void;
  onAnnotationsChange?: (sectionId: string, annotations: Annotation[]) => void;
  onPhotoClick?: (sectionId: string, photoId: string) => void;
  onImageUpload?: (sectionId: string, file: File) => void;
  onPhotoRemove?: (sectionId: string, photoId: string) => void;
  onPhotoResize?: (sectionId: string, photoId: string, widthPercent: number, customHeight?: number) => void;
  onPhotoCaptionChange?: (sectionId: string, photoId: string, caption: string) => void;
  onPhotoReorder?: (sectionId: string, fromIndex: number, toIndex: number) => void;
  onAnnotatePhoto?: (sectionId: string, photoId: string) => void;
  onEditPhoto?: (sectionId: string, photoId: string) => void;
  onPhotoObjectFitChange?: (sectionId: string, photoId: string, fit: 'cover' | 'contain') => void;
  /** When set, only render these photos instead of section.photos */
  photosSlice?: PhotoItem[];
  /** If true, this is a continuation page (no text blocks, shows "(cont.)" label) */
  isContinuation?: boolean;
  embedded?: boolean;
}

export function PageHeader({ code, revision }: { code: string; revision: number }) {
  return (
    <div className="flex items-center justify-between border-b-2 border-primary pb-2 mb-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
          <span className="text-primary-foreground text-xs font-bold">W</span>
        </div>
        <span className="text-[8px] font-semibold text-foreground">WEES</span>
      </div>
      <span className="text-[9px] font-bold text-foreground uppercase tracking-wide">
        Relatório de Serviços
      </span>
      <div className="text-[7px] text-muted-foreground text-right space-y-0.5">
        <div>Cód: {code || 'RS-000'}</div>
        <div>Rev: {String(revision).padStart(2, '0')}</div>
      </div>
    </div>
  );
}

export function PageFooter() {
  return (
    <div className="border-t border-muted-foreground/20 pt-1 mt-auto">
      <p className="text-[6px] text-muted-foreground text-center italic">
        Este documento é propriedade da WEES Engenharia e não pode ser reproduzido sem autorização.
      </p>
    </div>
  );
}

function PhotoControls({
  sectionId,
  photo,
  onRemove,
  onAnnotate,
  onToggleFit,
}: {
  sectionId: string;
  photo: PhotoItem;
  onRemove?: (sectionId: string, photoId: string) => void;
  onAnnotate?: (sectionId: string, photoId: string) => void;
  onToggleFit?: (sectionId: string, photoId: string) => void;
}) {
  const currentFit = photo.objectFit || 'contain';
  return (
    <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
      {onToggleFit && (
        <Button
          variant="secondary"
          size="sm"
          className="w-5 h-5 p-0 rounded-sm shadow-sm"
          onClick={(e) => { e.stopPropagation(); onToggleFit(sectionId, photo.id); }}
          title={currentFit === 'contain' ? 'Preencher' : 'Encaixar'}
        >
          {currentFit === 'contain' ? <Maximize2 className="w-2.5 h-2.5" /> : <Minimize2 className="w-2.5 h-2.5" />}
        </Button>
      )}
      {onAnnotate && (
        <Button
          variant="secondary"
          size="sm"
          className="w-5 h-5 p-0 rounded-sm shadow-sm"
          onClick={(e) => { e.stopPropagation(); onAnnotate(sectionId, photo.id); }}
          title="Anotar"
        >
          <Pencil className="w-2.5 h-2.5" />
        </Button>
      )}
      {onRemove && (
        <button
          className="w-5 h-5 bg-destructive text-destructive-foreground rounded-sm flex items-center justify-center shadow-sm"
          onClick={(e) => { e.stopPropagation(); onRemove(sectionId, photo.id); }}
          title="Remover foto"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );
}

/* ─── Draggable / Resizable / Editable Text Box ─── */
function TextAnnotationOverlay({
  ann,
  canvasSize,
  onUpdate,
  onDelete,
  activeTool,
}: {
  ann: Annotation;
  canvasSize: { width: number; height: number };
  onUpdate: (updated: Annotation) => void;
  onDelete: (id: string) => void;
  activeTool?: CanvasTool;
}) {
  const [editing, setEditing] = useState(!ann.text);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const w = ann.width || 140;
  const h = ann.height || 36;
  const x = ann.points[0]?.x || 0;
  const y = ann.points[0]?.y || 0;

  // Percentage-based positioning
  const leftPct = (x / canvasSize.width) * 100;
  const topPct = (y / canvasSize.height) * 100;

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const handleDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editing || !isCursorOrText) return;
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = x;
    const origY = y;

    const container = boxRef.current?.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const handleMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const scaleX = canvasSize.width / rect.width;
      const scaleY = canvasSize.height / rect.height;
      const newX = Math.max(0, Math.min(canvasSize.width - w, origX + dx * scaleX));
      const newY = Math.max(0, Math.min(canvasSize.height - h, origY + dy * scaleY));
      onUpdate({ ...ann, points: [{ x: newX, y: newY }] });
    };
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      setDragging(false);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const origW = w;
    const origH = h;

    const container = boxRef.current?.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const handleMove = (ev: MouseEvent) => {
      const scaleX = canvasSize.width / rect.width;
      const scaleY = canvasSize.height / rect.height;
      const newW = Math.max(60, origW + (ev.clientX - startX) * scaleX);
      const newH = Math.max(20, origH + (ev.clientY - startY) * scaleY);
      onUpdate({ ...ann, width: newW, height: newH });
    };
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      setResizing(false);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  const commitText = () => {
    setEditing(false);
    const val = textareaRef.current?.value || '';
    if (!val.trim() && !ann.text) {
      onDelete(ann.id);
    } else {
      onUpdate({ ...ann, text: val });
    }
  };

  const isCursorOrText = activeTool === 'cursor' || activeTool === 'text';

  return (
    <div
      ref={boxRef}
      className={cn(
        'absolute z-30 group/textbox',
        dragging && 'opacity-80',
        !isCursorOrText && 'pointer-events-none',
      )}
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${(w / canvasSize.width) * 100}%`,
        height: `${(h / canvasSize.height) * 100}%`,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={handleDragStart}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (isCursorOrText) setEditing(true);
      }}
    >
      {/* Border visible on hover or when editing */}
      <div className={cn(
        'absolute inset-0 border rounded-sm transition-colors',
        editing ? 'border-primary' : 'border-transparent group-hover/textbox:border-primary/50',
      )} />

      {editing ? (
        <textarea
          ref={textareaRef}
          defaultValue={ann.text || ''}
          className="w-full h-full bg-card/90 text-foreground text-[9px] p-1 resize-none outline-none rounded-sm border-none"
          style={{ color: ann.color }}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Escape') commitText();
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="block w-full h-full text-[9px] p-1 whitespace-pre-wrap overflow-hidden select-none cursor-move"
          style={{ color: ann.color }}
        >
          {ann.text || ''}
        </span>
      )}

      {/* Delete button */}
      {isCursorOrText && !editing && (
        <button
          className="absolute -top-2 -right-2 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover/textbox:opacity-100 transition-opacity z-10"
          onClick={(e) => { e.stopPropagation(); onDelete(ann.id); }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}

      {/* Resize handle (bottom-right corner) */}
      {isCursorOrText && !editing && (
        <div
          className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary border border-primary-foreground rounded-sm cursor-nwse-resize opacity-0 group-hover/textbox:opacity-100 transition-opacity z-10"
          onMouseDown={handleResizeStart}
        />
      )}
    </div>
  );
}

export function InteractivePdfPage({
  type,
  title = '',
  clientName = '',
  clientUnit = '',
  code = '',
  revision = 0,
  startDate,
  endDate,
  coverImageUrl,
  coverPhotos = [],
  showIrataSeals = true,
  irataLogoBrasilUrl,
  irataLogoInternationalUrl,
  section,
  sectionIndex = 0,
  activeTool,
  color,
  lineWidth: toolLineWidth,
  zoom,
  selectedSectionId,
  activePhotoId,
  onSelectSection,
  onTitleEdit,
  onBlockEdit,
  onAnnotationsChange,
  onPhotoClick,
  onImageUpload,
  onPhotoRemove,
  onPhotoResize,
  onPhotoCaptionChange,
  onPhotoReorder,
  onAnnotatePhoto,
  onEditPhoto,
  onPhotoObjectFitChange,
  onEditorChange,
  photosSlice,
  isContinuation = false,
  embedded = false,
}: InteractivePdfPageProps) {
  const zoomScale = (zoom || 100) / 100;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragPhotoIndex, setDragPhotoIndex] = useState<number | null>(null);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [activeEditor, setActiveEditorLocal] = useState<Editor | null>(null);
  const setActiveEditor = useCallback((editor: Editor | null) => {
    setActiveEditorLocal(editor);
    onEditorChange?.(editor);
  }, [onEditorChange]);
  const [resizingPhoto, setResizingPhoto] = useState<{ id: string; edge: 'right' | 'bottom'; startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);
  const [resizePreview, setResizePreview] = useState<{ id: string; width?: number; height?: number } | null>(null);

  const isDrawTool = activeTool ? ['pencil', 'circle', 'rect', 'arrow'].includes(activeTool) : false;
  const pageId = type === 'cover' ? '__cover__' : section?.id || '';
  const isSelected = selectedSectionId === pageId;
  const annotations = section?.annotations || [];

  // Canvas should render when there are annotations OR when drawing
  const hasDrawAnnotations = annotations.some(a => a.type !== 'text');
  const shouldRenderCanvas = (isDrawTool || hasDrawAnnotations) && canvasSize.width > 0;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setCanvasSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawAnnotations = annotations.filter(a => a.type !== 'text');
    const allAnnotations = [...drawAnnotations];
    if (isDrawing && currentPoints.length > 1) {
      allAnnotations.push({
        id: '__current__',
        type: activeTool as Annotation['type'],
        points: currentPoints,
        color,
        lineWidth: toolLineWidth,
      });
    }

    allAnnotations.forEach((ann) => {
      if (ann.points.length < 2) return;
      ctx.strokeStyle = ann.color;
      ctx.lineWidth = ann.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.fillStyle = 'transparent';

      const [start, ...rest] = ann.points;
      const end = ann.points[ann.points.length - 1];

      switch (ann.type) {
        case 'stroke': {
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          rest.forEach((p) => ctx.lineTo(p.x, p.y));
          ctx.stroke();
          break;
        }
        case 'circle': {
          const cx = (start.x + end.x) / 2;
          const cy = (start.y + end.y) / 2;
          const rx = Math.abs(end.x - start.x) / 2;
          const ry = Math.abs(end.y - start.y) / 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'rect': {
          ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
          break;
        }
        case 'arrow': {
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
          const angle = Math.atan2(end.y - start.y, end.x - start.x);
          const headLen = 10;
          ctx.beginPath();
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
          ctx.stroke();
          break;
        }
      }
    });
  }, [annotations, isDrawing, currentPoints, activeTool, color, toolLineWidth]);

  useEffect(() => { redraw(); }, [redraw]);

  const getPoint = (e: React.MouseEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const getPointFromContainer = (e: React.MouseEvent): Point => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvasSize.width,
      y: ((e.clientY - rect.top) / rect.height) * canvasSize.height,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDrawTool) return;
    e.preventDefault();
    const p = getPoint(e);
    setIsDrawing(true);
    setCurrentPoints([p]);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const p = getPoint(e);
    if (activeTool === 'pencil') {
      setCurrentPoints((prev) => [...prev, p]);
    } else {
      setCurrentPoints((prev) => [prev[0], p]);
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || currentPoints.length < 2) {
      setIsDrawing(false);
      setCurrentPoints([]);
      return;
    }
    const newAnn: Annotation = {
      id: crypto.randomUUID(),
      type: activeTool === 'pencil' ? 'stroke' : (activeTool as Annotation['type']),
      points: currentPoints,
      color,
      lineWidth: toolLineWidth,
    };
    if (section && onAnnotationsChange) {
      onAnnotationsChange(section.id, [...annotations, newAnn]);
    }
    setIsDrawing(false);
    setCurrentPoints([]);
  };

  const handlePageClick = (e: React.MouseEvent) => {
    // Text tool: create a new text annotation at click position
    if (activeTool === 'text' && section && onAnnotationsChange && canvasSize.width > 0) {
      const p = getPointFromContainer(e);
      const newText: Annotation = {
        id: crypto.randomUUID(),
        type: 'text',
        points: [p],
        color: color || 'hsl(var(--foreground))',
        lineWidth: toolLineWidth || 1,
        text: '',
        width: 140,
        height: 36,
      };
      onAnnotationsChange(section.id, [...annotations, newText]);
      return;
    }

    if (activeTool === 'cursor') {
      onSelectSection(pageId);
    }
  };

  // Text annotation helpers
  const handleTextUpdate = useCallback((updated: Annotation) => {
    if (!section || !onAnnotationsChange) return;
    onAnnotationsChange(section.id, annotations.map(a => a.id === updated.id ? updated : a));
  }, [section, onAnnotationsChange, annotations]);

  const handleTextDelete = useCallback((id: string) => {
    if (!section || !onAnnotationsChange) return;
    onAnnotationsChange(section.id, annotations.filter(a => a.id !== id));
  }, [section, onAnnotationsChange, annotations]);

  const textAnnotations = annotations.filter(a => a.type === 'text');

  // Drag-and-drop for files
  const handleDragOver = (e: React.DragEvent) => {
    if (type === 'cover' || !section) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (dragPhotoIndex !== null && section && onPhotoReorder) {
      const dropTarget = (e.target as HTMLElement).closest('[data-photo-index]');
      if (dropTarget) {
        const toIndex = parseInt(dropTarget.getAttribute('data-photo-index') || '0');
        if (toIndex !== dragPhotoIndex) {
          onPhotoReorder(section.id, dragPhotoIndex, toIndex);
        }
      }
      setDragPhotoIndex(null);
      return;
    }

    if (type === 'cover' || !section || !onImageUpload) return;
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onImageUpload(section.id, file);
    }
  };

  const handleAddPhotoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && section && onImageUpload) {
      onImageUpload(section.id, file);
    }
    e.target.value = '';
  };

  const cursorClass = activeTool === 'cursor' ? 'cursor-default' :
    activeTool === 'text' ? 'cursor-text' :
    isDrawTool ? 'cursor-crosshair' : 'cursor-default';

  const isTextEditable = !activeTool || activeTool === 'cursor' || activeTool === 'text';

  /* ─── Canvas + Text overlays shared renderer ─── */
  const renderCanvasAndTextOverlays = () => (
    <>
      {shouldRenderCanvas && (
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className={cn(
            'absolute inset-0 z-20',
            isDrawTool ? 'cursor-crosshair' : 'pointer-events-none',
          )}
          style={{ width: '100%', height: '100%' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      )}
      {canvasSize.width > 0 && textAnnotations.map(ann => (
        <TextAnnotationOverlay
          key={ann.id}
          ann={ann}
          canvasSize={canvasSize}
          onUpdate={handleTextUpdate}
          onDelete={handleTextDelete}
          activeTool={activeTool}
        />
      ))}
    </>
  );

  if (type === 'cover') {
    const photos = (coverPhotos && coverPhotos.length > 0)
      ? coverPhotos.filter(Boolean)
      : (coverImageUrl ? [coverImageUrl] : []);

    // Date labels: use startDate, fallback to current date for elegance (no ugly placeholders)
    const dateForLabels = (() => {
      if (startDate) {
        try { return parseISO(startDate); } catch { /* ignore */ }
      }
      return new Date();
    })();
    const monthLabel = format(dateForLabels, 'MMMM', { locale: ptBR }).toUpperCase();
    const yearLabel = format(dateForLabels, 'yyyy');

    const subtitleLine = (clientUnit || clientName || '').toUpperCase();
    const addressLine = 'Rua Antonio Baiocco, sn - Lote 14 - João Neiva, ES.';
    const todayLabel = format(new Date(), 'dd/MM/yyyy');

    // Technical metadata rows (key/value)
    const metaRows: { label: string; value: string }[] = [
      { label: 'CÓDIGO', value: code || 'RS-000' },
      { label: 'REVISÃO', value: String(revision ?? 0).padStart(2, '0') },
      { label: 'DATA', value: todayLabel },
    ];
    if (clientName) metaRows.push({ label: 'CLIENTE', value: clientName.toUpperCase() });
    if (clientUnit) metaRows.push({ label: 'UNIDADE', value: clientUnit.toUpperCase() });

    return (
      <div
        ref={containerRef}
        data-cover-page="true"
        className={cn(
          'bg-white border rounded shadow-sm aspect-[210/297] flex flex-col relative overflow-hidden transition-all',
          cursorClass,
          isSelected && 'ring-2 ring-primary'
        )}
        onClick={handlePageClick}
      >
        {/* Main split area */}
        <div className="flex-1 flex relative overflow-hidden">
          {/* Left red column — 38% (technical/sober, logo no topo) */}
          <div className="relative w-[38%] bg-primary text-primary-foreground flex flex-col justify-between px-8 py-9 z-10 font-sans">
            {/* Top — Logo WEES + data secundária */}
            <div>
              <CoverLogo size="md" />
              <div className="w-12 h-[1.5px] bg-white/40 mt-6" />
              <div className="mt-4 flex items-baseline gap-2">
                <p className="text-[8.5px] font-light text-white/80 uppercase" style={{ letterSpacing: '0.38em' }}>
                  {monthLabel}
                </p>
                <span className="text-white/40 text-[8.5px]">/</span>
                <p className="text-[15px] leading-none font-bold text-white tracking-tight">
                  {yearLabel}
                </p>
              </div>
            </div>

            {/* Middle — Title block + technical metadata */}
            <div className="space-y-5">
              <div>
                <p className="text-[7.5px] font-medium text-white/65 uppercase mb-2" style={{ letterSpacing: '0.4em' }}>
                  Documento Técnico
                </p>
                <h2 className="text-[19px] leading-[1.15] font-black text-white uppercase" style={{ letterSpacing: '0.01em' }}>
                  Relatório<br />de Serviços
                </h2>
                <div className="mt-3 w-6 h-[2px] bg-white" />
              </div>

              {/* Technical metadata table */}
              <div className="border-t border-white/30">
                {metaRows.map((row) => {
                  // Para valores potencialmente longos (CLIENTE/UNIDADE), reduz a
                  // largura do label e tira o `break-words` para evitar quebrar
                  // no meio da palavra (ex.: "ARCELORMIT TAL"). A palavra inteira
                  // será movida para a linha seguinte se não couber.
                  const isLongValue = row.label === 'CLIENTE' || row.label === 'UNIDADE';
                  return (
                    <div
                      key={row.label}
                      className="flex items-start border-b border-white/18 py-[6px] text-[8px]"
                    >
                      <span className="w-[58px] shrink-0 pr-2 font-semibold text-white/60 pt-[1px]" style={{ letterSpacing: '0.12em' }}>
                        {row.label}
                      </span>
                      <span
                        className={cn(
                          'flex-1 min-w-0 font-semibold text-white leading-[1.35]',
                          isLongValue ? 'break-normal' : 'break-words',
                        )}
                        style={{
                          letterSpacing: isLongValue ? '0.02em' : '0.04em',
                          wordBreak: isLongValue ? 'normal' : undefined,
                          overflowWrap: isLongValue ? 'normal' : 'break-word',
                          hyphens: 'none',
                        }}
                      >
                        {row.value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom — Certificadora (logos maiores, sem fundo branco) */}
            {showIrataSeals && (
              <div>
                <p className="text-[7px] font-bold text-white/65 mb-2.5 uppercase" style={{ letterSpacing: '0.38em' }}>
                  Certificadora
                </p>
                <div className="flex items-center gap-4">
                  <IrataLogoSlot url={irataLogoBrasilUrl} fallbackSrc={irataBrasilLogoFixed} label="BRASIL" />
                  <IrataLogoSlot url={irataLogoInternationalUrl} fallbackSrc={irataInternationalLogoFixed} label="INTL" />
                </div>
              </div>
            )}
          </div>

          {/* Right white area — fotos com mais respiro (sem logo) */}
          <div className="relative flex-1 bg-white overflow-hidden flex flex-col">
            {/* Editorial spine accent */}
            <div className="absolute top-0 left-0 w-[2px] h-full bg-primary" />

            {/* Photo mosaic OR technical empty state */}
            <div className="flex-1 flex items-center justify-center px-10 py-12">
              {photos.length > 0 ? (
                <div className="w-full h-full max-w-[340px]">
                  <PhotoMosaic photos={photos} />
                </div>
              ) : (
                <div className="w-full h-full max-w-[260px] border border-border rounded-md flex flex-col items-center justify-center text-muted-foreground/70 px-6 text-center">
                  <ImagePlus className="w-8 h-8 mb-3 stroke-[1.5]" />
                  <p className="text-[10px] font-semibold text-foreground/70 uppercase" style={{ letterSpacing: '0.22em' }}>
                    Registro fotográfico
                  </p>
                  <p className="text-[9px] mt-2 leading-relaxed text-muted-foreground">
                    Adicione até 4 fotos da obra no painel à direita
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer band — website (mais fino para quebrar o "L") */}
        <div className="bg-primary text-primary-foreground px-6 py-[7px] flex items-center justify-center gap-2.5">
          <Globe className="w-3.5 h-3.5" />
          <span className="text-[10.5px] font-medium" style={{ letterSpacing: '0.08em' }}>
            weesservicos.com.br
          </span>
        </div>

        {/* Address footer */}
        <div className="bg-white px-6 py-2 flex items-center justify-center gap-2 border-t border-border">
          <MapPin className="w-3 h-3 text-primary shrink-0" />
          <span className="text-[9px] text-foreground/70 tracking-wide">{addressLine}</span>
        </div>

        {renderCanvasAndTextOverlays()}
      </div>
    );
  }

  if (!section) return null;

  return (
    <div
      ref={containerRef}
        className={cn(
          embedded
            ? 'relative space-y-2'
            : 'bg-card border rounded shadow-sm aspect-[210/297] p-5 flex flex-col relative overflow-hidden transition-all',
          !embedded && cursorClass,
          !embedded && isSelected && 'ring-2 ring-primary',
          !embedded && isDragging && 'ring-2 ring-primary/60 bg-primary/5'
        )}
      onClick={handlePageClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {!embedded && isDragging && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded pointer-events-none">
          <div className="flex flex-col items-center gap-1">
            <ImagePlus className="w-8 h-8 text-primary" />
            <span className="text-xs font-semibold text-primary">Solte a imagem aqui</span>
          </div>
        </div>
      )}

      {!embedded && <PageHeader code={code} revision={revision} />}

      <div className={embedded ? 'space-y-2' : 'flex-1 overflow-hidden space-y-2'}>
        <h3 className="text-[10px] font-bold text-foreground uppercase flex items-baseline gap-1">
          {getSectionNumberPrefix(section.title, sectionIndex) && (
            <span>{getSectionNumberPrefix(section.title, sectionIndex).trim()}</span>
          )}
          {isContinuation ? (
            <span className="text-[10px] font-bold text-foreground uppercase">
              {(section.title || '').replace(/<[^>]*>/g, '').trim()} <span className="text-muted-foreground font-normal">(continuação)</span>
            </span>
          ) : (
            <StableEditableText
              text={section.title}
              className="text-[10px] font-bold text-foreground uppercase"
              isTextEditable={isTextEditable}
              setActiveEditor={setActiveEditor}
              onBlur={(v) => {
                if (onBlockEdit && section) onBlockEdit(section.id, '__title__', v);
              }}
            />
          )}
        </h3>

        {!isContinuation && section.content.map((block) => (
          <div key={block.id}>
            {block.type === 'heading' && (
              <RichTextBlock
                content={block.text}
                onChange={() => { /* commit on blur to avoid re-pagination mid-edit */ }}
                onCommit={(html) => onBlockEdit?.(section.id, block.id, html)}
                onFocus={(editor) => setActiveEditor(editor)}
                variant="heading"
                className="text-[11px]"
                editable={isTextEditable}
                placeholder="Subtítulo..."
              />
            )}
            {block.type === 'paragraph' && (
              <RichTextBlock
                content={block.text}
                onChange={() => { /* commit on blur to avoid re-pagination mid-edit */ }}
                onCommit={(html) => onBlockEdit?.(section.id, block.id, html)}
                onFocus={(editor) => setActiveEditor(editor)}
                variant="paragraph"
                className="text-[10px]"
                editable={isTextEditable}
                placeholder="Escreva aqui..."
              />
            )}
            {block.type === 'list' && (
              <RichTextBlock
                content={block.text}
                onChange={() => { /* commit on blur to avoid re-pagination mid-edit */ }}
                onCommit={(html) => onBlockEdit?.(section.id, block.id, html)}
                onFocus={(editor) => setActiveEditor(editor)}
                variant="paragraph"
                className="text-[10px]"
                editable={isTextEditable}
                placeholder="Item da lista..."
              />
            )}
          </div>
        ))}

        <div className="flex flex-wrap gap-1.5 mt-2">
          {(photosSlice ?? section.photos).map((photo, photoIdx) => {
            const previewH = resizePreview?.id === photo.id ? resizePreview.height : undefined;
            const photoHeight = previewH ?? photo.customHeight ?? 160;
            const previewW = resizePreview?.id === photo.id && resizePreview.width !== undefined ? resizePreview.width : undefined;
            const widthPct = previewW ?? photo.widthPercent ?? 50;
            const fitMode = photo.objectFit || 'contain';
            const isActive = activePhotoId === photo.id;

            const startResize = (
              e: React.MouseEvent,
              mode: 'corner' | 'right' | 'bottom',
            ) => {
              e.preventDefault();
              e.stopPropagation();

              const container = (e.target as HTMLElement).closest('.flex.flex-wrap') as HTMLElement;
              if (!container) return;
              const containerWidth = container.clientWidth;
              const startX = e.clientX;
              const startY = e.clientY;
              const startWPct = widthPct;
              const startH = photoHeight;
              const photoEl = (e.target as HTMLElement).closest('[data-photo-index]')?.querySelector('img');
              const aspectRatio = photoEl ? photoEl.naturalWidth / photoEl.naturalHeight : 1;

              let latestWPct = startWPct;
              let latestH = startH;

              setResizingPhoto({ id: photo.id, edge: mode === 'bottom' ? 'bottom' : 'right', startX, startY, startWidth: startWPct, startHeight: startH });

              const handleMove = (ev: MouseEvent) => {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;

                if (mode === 'right') {
                  latestWPct = Math.max(15, Math.min(100, startWPct + (dx / containerWidth) * 100));
                  setResizePreview({ id: photo.id, width: latestWPct, height: startH });
                } else if (mode === 'bottom') {
                  latestH = Math.max(32, startH + dy);
                  setResizePreview({ id: photo.id, height: latestH, width: startWPct });
                } else {
                  latestWPct = Math.max(15, Math.min(100, startWPct + (dx / containerWidth) * 100));
                  const newWidthPx = (latestWPct / 100) * containerWidth;
                  latestH = newWidthPx / aspectRatio;
                  setResizePreview({ id: photo.id, width: latestWPct, height: latestH });
                }
              };
              const handleUp = () => {
                document.removeEventListener('mousemove', handleMove);
                document.removeEventListener('mouseup', handleUp);
                setResizingPhoto(null);
                onPhotoResize?.(section.id, photo.id, latestWPct, mode !== 'right' ? latestH : photo.customHeight);
                setResizePreview(null);
              };
              document.addEventListener('mousemove', handleMove);
              document.addEventListener('mouseup', handleUp);
            };

            return (
              <div
                key={photo.id}
                data-photo-index={photoIdx}
                draggable={activeTool === 'cursor' && !resizingPhoto}
                onDragStart={(e) => {
                  if (resizingPhoto) { e.preventDefault(); return; }
                  e.stopPropagation();
                  setDragPhotoIndex(photoIdx);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => setDragPhotoIndex(null)}
                onDragOver={(e) => {
                  if (dragPhotoIndex !== null && dragPhotoIndex !== photoIdx) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                onDrop={(e) => {
                  if (dragPhotoIndex !== null && dragPhotoIndex !== photoIdx && section && onPhotoReorder) {
                    e.preventDefault();
                    e.stopPropagation();
                    onPhotoReorder(section.id, dragPhotoIndex, photoIdx);
                    setDragPhotoIndex(null);
                  }
                }}
                className={cn(
                  'overflow-visible rounded group relative shrink-0',
                  isActive ? 'border-2 border-primary shadow-sm' : 'border border-border',
                  dragPhotoIndex === photoIdx && 'opacity-50',
                  dragPhotoIndex !== null && dragPhotoIndex !== photoIdx && 'border-dashed border-primary/40',
                )}
                style={{ width: `calc(${widthPct}% - 6px)` }}
                onClick={(e) => {
                  e.stopPropagation();
                  onPhotoClick?.(section.id, photo.id);
                }}
              >
                {activeTool === 'cursor' && !resizingPhoto && (
                  <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-grab">
                    <GripVertical className="w-3 h-3 text-foreground/70" />
                  </div>
                )}

                {activeTool === 'cursor' && (
                  <PhotoControls
                    photo={photo}
                    sectionId={section.id}
                    onRemove={onPhotoRemove}
                    onAnnotate={onAnnotatePhoto}
                    onToggleFit={onPhotoObjectFitChange ? (sid, pid) => {
                      onPhotoObjectFitChange(sid, pid, fitMode === 'contain' ? 'cover' : 'contain');
                    } : undefined}
                  />
                )}

                <div className="bg-muted/20 overflow-hidden rounded-t">
                  <img
                    src={photo.url}
                    alt={photo.caption}
                    className={cn(
                      'w-full',
                      fitMode === 'contain' ? 'object-contain' : 'object-cover',
                      activeTool === 'cursor' && 'cursor-pointer'
                    )}
                    style={{ height: `${photoHeight}px`, maxHeight: '520px' }}
                    title={activeTool === 'cursor' ? 'Duplo-clique para ajustar (recortar, girar, brilho)' : undefined}
                    onDoubleClick={(e) => {
                      if (activeTool !== 'cursor') return;
                      e.stopPropagation();
                      e.preventDefault();
                      onEditPhoto?.(section.id, photo.id);
                    }}
                  />
                </div>

                {activeTool === 'cursor' && isActive && (
                  <>
                    {(['tl', 'tr', 'bl', 'br'] as const).map((pos) => {
                      const isTop = pos[0] === 't';
                      const isLeft = pos[1] === 'l';
                      return (
                        <div
                          key={pos}
                          className={cn(
                            'absolute w-3 h-3 bg-primary border-2 border-primary-foreground rounded-sm z-20 shadow-md',
                            isTop ? '-top-1.5' : '-bottom-1.5',
                            isLeft ? '-left-1.5' : '-right-1.5',
                            (isTop === isLeft) ? 'cursor-nwse-resize' : 'cursor-nesw-resize',
                          )}
                          onMouseDown={(e) => startResize(e, 'corner')}
                        />
                      );
                    })}
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-5 h-3 bg-primary border-2 border-primary-foreground rounded-sm z-20 cursor-ns-resize shadow-md" onMouseDown={(e) => startResize(e, 'bottom')} />
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-3 bg-primary border-2 border-primary-foreground rounded-sm z-20 cursor-ns-resize shadow-md" onMouseDown={(e) => startResize(e, 'bottom')} />
                    <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-5 bg-primary border-2 border-primary-foreground rounded-sm z-20 cursor-ew-resize shadow-md" onMouseDown={(e) => startResize(e, 'right')} />
                    <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-5 bg-primary border-2 border-primary-foreground rounded-sm z-20 cursor-ew-resize shadow-md" onMouseDown={(e) => startResize(e, 'right')} />
                  </>
                )}

                {activeTool === 'cursor' && isActive && resizingPhoto?.id === photo.id && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[8px] px-1.5 py-0.5 rounded shadow-md z-30 whitespace-nowrap">
                    {Math.round(previewW ?? widthPct)}% × {Math.round(previewH ?? photoHeight)}px
                  </div>
                )}

                {activeTool === 'cursor' && editingCaption === photo.id ? (
                  <input
                    type="text"
                    defaultValue={photo.caption}
                    autoFocus
                    className="text-[6px] text-center text-muted-foreground py-0.5 px-1 w-full bg-transparent border-t border-dashed border-primary/40 outline-none"
                    onBlur={(e) => {
                      onPhotoCaptionChange?.(section.id, photo.id, e.target.value);
                      setEditingCaption(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onPhotoCaptionChange?.(section.id, photo.id, (e.target as HTMLInputElement).value);
                        setEditingCaption(null);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p
                    className={cn(
                      'text-[6px] text-center text-muted-foreground py-0.5 px-1 truncate',
                      activeTool === 'cursor' && 'cursor-text hover:bg-primary/5 transition-colors'
                    )}
                    onClick={(e) => {
                      if (activeTool === 'cursor') {
                        e.stopPropagation();
                        setEditingCaption(photo.id);
                      }
                    }}
                  >
                    {photo.caption || (activeTool === 'cursor' ? 'Clique para legendar' : '')}
                  </p>
                )}
              </div>
            );
          })}

          {activeTool === 'cursor' && onImageUpload && (
            <div
              className="border-2 border-dashed border-muted-foreground/30 rounded flex flex-col items-center justify-center h-16 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors shrink-0"
              style={{ width: 'calc(50% - 6px)' }}
              onClick={handleAddPhotoClick}
            >
              <ImagePlus className="w-4 h-4 text-muted-foreground/50" />
              <span className="text-[7px] text-muted-foreground/50 mt-0.5">+ Foto</span>
            </div>
          )}
        </div>
      </div>

      {!embedded && <PageFooter />}

      {!embedded && renderCanvasAndTextOverlays()}
    </div>
  );
}
