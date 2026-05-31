import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Slider } from '@/components/ui/slider';
import {
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Palette, Sparkles, Highlighter, RemoveFormatting,
  Type, Loader2, Expand, FileText, Wand2, GraduationCap, Minimize2, Heading,
  Link as LinkIcon, Subscript, Superscript, Undo2, Redo2, Minus,
  MousePointer2, Square, Circle, MoveRight,
  Pencil, TypeIcon, ImagePlus, FilePlus2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type DrawTool = 'cursor' | 'pencil' | 'circle' | 'rect' | 'arrow' | 'text' | 'image';

interface FloatingToolbarProps {
  editor: Editor | null;
  activeTool?: DrawTool;
  onToolChange?: (tool: DrawTool) => void;
  onImageUpload?: () => void;
  drawColor?: string;
  onDrawColorChange?: (color: string) => void;
  drawLineWidth?: number;
  onDrawLineWidthChange?: (width: number) => void;
  onAddPage?: (type: string) => void;
  className?: string;
}

const STROKE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6',
  '#ec4899', '#14b8a6', '#000000', '#ffffff',
];

const COLORS = [
  'hsl(var(--foreground))',
  'hsl(var(--primary))',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6',
  '#ec4899', '#14b8a6', '#6366f1', '#000000',
];

const HIGHLIGHT_COLORS = [
  '#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa',
  '#ccfbf1', '#fce7f3', '#e0e7ff', '#f5f5f4',
];

const MAGIC_ACTIONS = [
  { action: 'expand', label: 'Expandir', icon: Expand, description: 'Adicionar detalhes técnicos' },
  { action: 'summarize', label: 'Resumir', icon: Minimize2, description: 'Condensar em pontos-chave' },
  { action: 'improve', label: 'Melhorar', icon: Wand2, description: 'Gramática e clareza' },
  { action: 'formalize', label: 'Formalizar', icon: GraduationCap, description: 'Linguagem técnica ABNT' },
  { action: 'simplify', label: 'Simplificar', icon: FileText, description: 'Linguagem acessível' },
  { action: 'generate_title', label: 'Gerar Título', icon: Heading, description: 'Título baseado no conteúdo' },
];

const DRAW_TOOLS: { tool: DrawTool; icon: any; label: string }[] = [
  { tool: 'cursor', icon: MousePointer2, label: 'Selecionar' },
  { tool: 'rect', icon: Square, label: 'Retângulo' },
  { tool: 'circle', icon: Circle, label: 'Elipse' },
  { tool: 'arrow', icon: MoveRight, label: 'Seta' },
  { tool: 'pencil', icon: Pencil, label: 'Caneta' },
  { tool: 'text', icon: TypeIcon, label: 'Texto' },
  { tool: 'image', icon: ImagePlus, label: 'Imagem' },
];

export function FloatingToolbar({
  editor,
  activeTool = 'cursor',
  onToolChange,
  onImageUpload,
  drawColor = '#ef4444',
  onDrawColorChange,
  drawLineWidth = 2,
  onDrawLineWidthChange,
  onAddPage,
  className,
}: FloatingToolbarProps) {
  const [aiLoading, setAiLoading] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const handleMagicWrite = async (action: string) => {
    if (!editor || aiLoading) return;

    const { from, to } = editor.state.selection;
    const selectedText = from !== to ? editor.state.doc.textBetween(from, to) : '';
    const text = selectedText || editor.getHTML();

    if (!text || text === '<p></p>') {
      toast.error('Escreva algum texto antes de usar a IA');
      return;
    }

    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('magic-write', {
        body: { text, action },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.result) {
        if (selectedText && from !== to) {
          editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, data.result).run();
        } else {
          // emitUpdate:false avoids triggering an extra re-pagination cascade.
          editor.commands.setContent(data.result, { emitUpdate: false } as any);
          // Manually emit so onUpdate fires once with the new content.
          editor.commands.focus();
        }
        toast.success('Texto atualizado com IA ✨');
      }
    } catch (err: any) {
      toast.error('Erro ao processar: ' + (err?.message || 'Tente novamente'));
    } finally {
      setAiLoading(false);
    }
  };

  const handleSetLink = () => {
    if (!editor) return;
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setLinkOpen(false);
    setLinkUrl('');
  };

  const handleDrawToolClick = (tool: DrawTool) => {
    if (tool === 'image' && onImageUpload) {
      onImageUpload();
      return;
    }
    onToolChange?.(tool);
  };

  const currentFontSize = editor && !editor.isDestroyed
    ? parseInt(editor.getAttributes('textStyle').fontSize || '8', 10)
    : 8;

  const editorActive = !!editor && !editor.isDestroyed;

  const ToolBtn = ({
    active, onClick, children, title, btnDisabled,
  }: {
    active?: boolean; onClick: () => void; children: React.ReactNode; title: string; btnDisabled?: boolean;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn('h-9 w-9 p-0', active && 'bg-accent text-accent-foreground')}
      // preventDefault on mousedown keeps the selection inside the editor when
      // a toolbar button is pressed — essential to avoid losing the range.
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      title={title}
      disabled={btnDisabled}
    >
      {children}
    </Button>
  );

  return (
    <div
      className={cn(
        "absolute left-3 top-3 bottom-3 z-[100] flex flex-col gap-0.5 items-center bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl px-2 py-1.5 transition-all duration-200",
        className
      )}
      onMouseDown={(e) => e.preventDefault()}
    >

      {/* Group 1: Drawing tools */}
      {DRAW_TOOLS.map(({ tool, icon: Icon, label }) => (
        <Button
          key={tool}
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            'h-9 w-9 p-0',
            activeTool === tool && 'bg-accent text-accent-foreground',
          )}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDrawToolClick(tool); }}
          title={label}
        >
          <Icon className="w-[18px] h-[18px]" />
        </Button>
      ))}

      <Separator orientation="horizontal" className="w-full my-0" />

      {/* Group 2: Draw color + stroke width */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" title="Cor do traço">
            <div className="w-4 h-4 rounded-full border-2 border-border" style={{ backgroundColor: drawColor }} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2 z-[200]" align="center" side="right" sideOffset={8} onMouseDown={(e) => e.preventDefault()}>
          <div className="flex flex-wrap gap-1 max-w-[130px]">
            {STROKE_COLORS.map((c) => (
              <button
                key={c}
                className={cn(
                  'w-5 h-5 rounded-full border-2 hover:scale-110 transition-transform',
                  drawColor === c ? 'border-primary ring-1 ring-primary' : 'border-border'
                )}
                style={{ backgroundColor: c }}
                onClick={() => onDrawColorChange?.(c)}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-[10px]" title="Espessura do traço">
            <Minus className="w-3 h-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-32 p-3 z-[200]" align="center" side="right" sideOffset={8} onMouseDown={(e) => e.preventDefault()}>
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1</span>
              <span className="font-medium text-foreground">{drawLineWidth}px</span>
              <span>10</span>
            </div>
            <Slider
              min={1}
              max={10}
              step={1}
              value={[drawLineWidth]}
              onValueChange={([v]) => onDrawLineWidthChange?.(v)}
            />
          </div>
        </PopoverContent>
      </Popover>

      <Separator orientation="horizontal" className="w-full my-0" />

      {/* Group 3: AI Magic Write */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-9 w-9 p-0', aiLoading && 'opacity-70')}
            disabled={aiLoading}
            title="Magic Write IA"
          >
            {aiLoading ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Sparkles className="w-[18px] h-[18px] text-amber-500" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" sideOffset={8} className="w-52 z-[200]">
          <DropdownMenuLabel className="text-xs flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-500" /> Magic Write
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {MAGIC_ACTIONS.map(({ action, label, icon: Icon, description }) => (
            <DropdownMenuItem
              key={action}
              onClick={() => handleMagicWrite(action)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <div className="flex flex-col">
                <span className="text-xs font-medium">{label}</span>
                <span className="text-[10px] text-muted-foreground">{description}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="horizontal" className="w-full my-0" />

      {/* Group 4: Text formatting */}
      <ToolBtn active={editorActive && editor!.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()} title="Negrito" btnDisabled={!editorActive}>
        <Bold className="w-[18px] h-[18px]" />
      </ToolBtn>
      <ToolBtn active={editorActive && editor!.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()} title="Itálico" btnDisabled={!editorActive}>
        <Italic className="w-[18px] h-[18px]" />
      </ToolBtn>
      <ToolBtn active={editorActive && editor!.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()} title="Sublinhado" btnDisabled={!editorActive}>
        <Underline className="w-[18px] h-[18px]" />
      </ToolBtn>
      <ToolBtn active={editorActive && editor!.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()} title="Tachado" btnDisabled={!editorActive}>
        <Strikethrough className="w-[18px] h-[18px]" />
      </ToolBtn>

      {/* Link */}
      <Popover open={linkOpen} onOpenChange={setLinkOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-9 w-9 p-0', editorActive && editor!.isActive('link') && 'bg-accent text-accent-foreground')}
            title="Link"
            onClick={() => {
              if (editorActive && editor!.isActive('link')) {
                setLinkUrl(editor!.getAttributes('link').href || '');
              }
            }}
          >
            <LinkIcon className="w-[18px] h-[18px]" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2 z-[200]" align="center" side="right" sideOffset={8} onMouseDown={(e) => e.preventDefault()}>
          <div className="flex gap-1">
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="h-7 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleSetLink()}
            />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={handleSetLink}>
              OK
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <ToolBtn active={editorActive && editor!.isActive('subscript')} onClick={() => editor?.chain().focus().toggleSubscript().run()} title="Subscrito" btnDisabled={!editorActive}>
        <Subscript className="w-[18px] h-[18px]" />
      </ToolBtn>
      <ToolBtn active={editorActive && editor!.isActive('superscript')} onClick={() => editor?.chain().focus().toggleSuperscript().run()} title="Sobrescrito" btnDisabled={!editorActive}>
        <Superscript className="w-[18px] h-[18px]" />
      </ToolBtn>

      <Separator orientation="horizontal" className="w-full my-0" />

      {/* Group 5: Alignment + Lists */}
      <ToolBtn active={editorActive && editor!.isActive({ textAlign: 'left' })} onClick={() => editor?.chain().focus().setTextAlign('left').run()} title="Alinhar à esquerda" btnDisabled={!editorActive}>
        <AlignLeft className="w-[18px] h-[18px]" />
      </ToolBtn>
      <ToolBtn active={editorActive && editor!.isActive({ textAlign: 'center' })} onClick={() => editor?.chain().focus().setTextAlign('center').run()} title="Centralizar" btnDisabled={!editorActive}>
        <AlignCenter className="w-[18px] h-[18px]" />
      </ToolBtn>
      <ToolBtn active={editorActive && editor!.isActive({ textAlign: 'right' })} onClick={() => editor?.chain().focus().setTextAlign('right').run()} title="Alinhar à direita" btnDisabled={!editorActive}>
        <AlignRight className="w-[18px] h-[18px]" />
      </ToolBtn>
      <ToolBtn active={editorActive && editor!.isActive({ textAlign: 'justify' })} onClick={() => editor?.chain().focus().setTextAlign('justify').run()} title="Justificar" btnDisabled={!editorActive}>
        <AlignJustify className="w-[18px] h-[18px]" />
      </ToolBtn>
      <ToolBtn active={editorActive && editor!.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()} title="Lista" btnDisabled={!editorActive}>
        <List className="w-[18px] h-[18px]" />
      </ToolBtn>
      <ToolBtn active={editorActive && editor!.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()} title="Lista numerada" btnDisabled={!editorActive}>
        <ListOrdered className="w-[18px] h-[18px]" />
      </ToolBtn>
      <ToolBtn onClick={() => editor?.chain().focus().setHorizontalRule().run()} title="Separador horizontal" btnDisabled={!editorActive}>
        <Minus className="w-[18px] h-[18px]" />
      </ToolBtn>

      <Separator orientation="horizontal" className="w-full my-0" />

      {/* Group 6: Font size, text color, highlight, clear */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-[10px]" title="Tamanho da fonte">
            <Type className="w-[18px] h-[18px]" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2 z-[200]" align="center" side="right" sideOffset={8} onMouseDown={(e) => e.preventDefault()}>
          <div className="grid grid-cols-4 gap-1">
            {[6, 8, 10, 12, 14, 16, 18].map((size) => (
              <button
                key={size}
                className={cn(
                  'h-7 w-9 rounded text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                  currentFontSize === size && 'bg-primary text-primary-foreground'
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  (editor as any)?.chain().focus().setFontSize(`${size}px`).run();
                }}
              >
                {size}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" title="Cor do texto">
            <Palette className="w-[18px] h-[18px]" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2 z-[200]" align="center" side="right" sideOffset={8} onMouseDown={(e) => e.preventDefault()}>
          <div className="flex flex-wrap gap-1 max-w-[140px]">
            {COLORS.map((c) => (
              <button
                key={c}
                className="w-5 h-5 rounded-full border border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor?.chain().focus().setColor(c).run()}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Highlight */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-9 w-9 p-0', editorActive && editor!.isActive('highlight') && 'bg-accent text-accent-foreground')}
            title="Destacar texto"
          >
            <Highlighter className="w-[18px] h-[18px]" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2 z-[200]" align="center" side="right" sideOffset={8} onMouseDown={(e) => e.preventDefault()}>
          <div className="flex flex-wrap gap-1 max-w-[140px]">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
                onClick={() => editor?.chain().focus().toggleHighlight({ color: c }).run()}
              />
            ))}
            <button
              className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform flex items-center justify-center text-[8px] text-muted-foreground"
              onClick={() => editor?.chain().focus().unsetHighlight().run()}
              title="Remover destaque"
            >
              ✕
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <ToolBtn onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()} title="Limpar formatação" btnDisabled={!editorActive}>
        <RemoveFormatting className="w-[18px] h-[18px]" />
      </ToolBtn>

      <Separator orientation="horizontal" className="w-full my-0" />

      {/* Group 7: Undo / Redo */}
      <ToolBtn onClick={() => editor?.chain().focus().undo().run()} title="Desfazer" btnDisabled={editorActive ? !editor!.can().undo() : true}>
        <Undo2 className="w-[18px] h-[18px]" />
      </ToolBtn>
      <ToolBtn onClick={() => editor?.chain().focus().redo().run()} title="Refazer" btnDisabled={editorActive ? !editor!.can().redo() : true}>
        <Redo2 className="w-[18px] h-[18px]" />
      </ToolBtn>

      <Separator orientation="horizontal" className="w-full my-0" />

      {/* Group 8: Add Page */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" title="Nova página">
            <FilePlus2 className="w-[18px] h-[18px]" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" sideOffset={8} className="w-40 z-[200]">
          <DropdownMenuLabel className="text-xs">Nova Página</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {[
            { type: 'scope', label: 'Escopo' },
            { type: 'execution', label: 'Execução' },
            { type: 'safety', label: 'Segurança' },
            { type: 'conclusion', label: 'Conclusão' },
            { type: 'custom', label: 'Personalizada' },
          ].map(({ type, label }) => (
            <DropdownMenuItem key={type} onClick={() => onAddPage?.(type)} className="cursor-pointer text-xs">
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
