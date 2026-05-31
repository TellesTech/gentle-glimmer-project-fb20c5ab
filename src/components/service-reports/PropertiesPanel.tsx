import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, Trash2, Settings2, ImagePlus, Image as ImageIcon, Loader2, X, ChevronLeft, FileText, Sparkles } from 'lucide-react';
import { PhotoBlockEditor, type PhotoItem } from './PhotoBlockEditor';
import type { ContentBlock } from './SectionEditor';
import { compressImage } from '@/lib/imageCompression';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CoverPhotoPickerDialog } from './CoverPhotoPickerDialog';

interface Section {
  id: string;
  title: string;
  sectionType: string;
  content: ContentBlock[];
  photos: PhotoItem[];
}

interface PropertiesPanelProps {
  title: string;
  clientName: string;
  clientUnit: string;
  clientContact: string;
  subject: string;
  code: string;
  startDate: string;
  endDate: string;
  conclusion: string;
  siteId: string;
  projectId: string;
  reportId?: string;
  coverImageUrl?: string | null;
  onCoverImageChange?: (url: string | null) => void;
  coverPhotos?: string[];
  onCoverPhotosChange?: (photos: string[]) => void;
  showIrataSeals?: boolean;
  onShowIrataSealsChange?: (v: boolean) => void;
  irataLogoBrasilUrl?: string | null;
  onIrataLogoBrasilChange?: (url: string | null) => void;
  irataLogoInternationalUrl?: string | null;
  onIrataLogoInternationalChange?: (url: string | null) => void;
  sites: any[];
  siteProjects: any[];
  onFieldChange: (field: string, value: string) => void;
  onSiteChange: (siteId: string) => void;
  onProjectChange: (projectId: string) => void;
  selectedSection: Section | null;
  activePhotoId?: string | null;
  onClearSelection?: () => void;
  onSectionTitleChange: (id: string, title: string) => void;
  onSectionTypeChange: (id: string, type: string) => void;
  onSectionContentChange: (id: string, content: ContentBlock[]) => void;
  onSectionPhotosChange: (id: string, photos: PhotoItem[]) => void;
  onSectionDelete: (id: string) => void;
}

const sectionTypeLabels: Record<string, string> = {
  scope: 'Escopo',
  safety: 'Segurança',
  execution: 'Execução',
  conclusion: 'Conclusão',
  custom: 'Personalizada',
};

export function PropertiesPanel({
  clientName, clientUnit, clientContact, subject, code,
  startDate, endDate, conclusion, siteId, projectId,
  reportId,
  coverPhotos = [], onCoverPhotosChange,
  showIrataSeals = true, onShowIrataSealsChange,
  irataLogoBrasilUrl, onIrataLogoBrasilChange,
  irataLogoInternationalUrl, onIrataLogoInternationalChange,
  sites, siteProjects,
  onFieldChange, onSiteChange, onProjectChange,
  selectedSection,
  activePhotoId,
  onClearSelection,
  onSectionTitleChange, onSectionTypeChange,
  onSectionContentChange, onSectionPhotosChange, onSectionDelete,
}: PropertiesPanelProps) {
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [uploadingIrata, setUploadingIrata] = useState<'brasil' | 'international' | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleSlotUpload = async (slotIndex: number, file: File) => {
    if (!reportId) {
      toast.error('Salve o relatório antes de enviar fotos');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem');
      return;
    }
    setUploadingSlot(slotIndex);
    try {
      const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.82 });
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `covers/${reportId}/mosaic-${slotIndex}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('service-report-photos')
        .upload(path, compressed.blob, { upsert: true, contentType: compressed.blob.type || file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('service-report-photos').getPublicUrl(path);
      const updated = [...coverPhotos];
      while (updated.length <= slotIndex) updated.push('');
      updated[slotIndex] = data.publicUrl;
      onCoverPhotosChange?.(updated.filter(Boolean));
      toast.success(`Foto ${slotIndex + 1} enviada`);
    } catch (err: any) {
      toast.error('Erro no upload: ' + (err?.message || 'tente novamente'));
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleRemoveSlot = (idx: number) => {
    const updated = [...coverPhotos];
    updated.splice(idx, 1);
    onCoverPhotosChange?.(updated);
  };

  const handleIrataUpload = async (
    which: 'brasil' | 'international',
    file: File,
  ) => {
    if (!reportId) {
      toast.error('Salve o relatório antes de enviar logos');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem');
      return;
    }
    setUploadingIrata(which);
    try {
      const compressed = await compressImage(file, { maxWidth: 600, maxHeight: 600, quality: 0.9 });
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `irata-logos/${reportId}/${which}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('service-report-photos')
        .upload(path, compressed.blob, { upsert: true, contentType: compressed.blob.type || file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('service-report-photos').getPublicUrl(path);
      if (which === 'brasil') onIrataLogoBrasilChange?.(data.publicUrl);
      else onIrataLogoInternationalChange?.(data.publicUrl);
      toast.success(`Logo IRATA ${which === 'brasil' ? 'Brasil' : 'Internacional'} enviado`);
    } catch (err: any) {
      toast.error('Erro no upload: ' + (err?.message || 'tente novamente'));
    } finally {
      setUploadingIrata(null);
    }
  };

  const renderIrataUploader = (
    which: 'brasil' | 'international',
    label: string,
    url?: string | null,
  ) => {
    const onClear = () => {
      if (which === 'brasil') onIrataLogoBrasilChange?.(null);
      else onIrataLogoInternationalChange?.(null);
    };
    return (
      <div className="space-y-1">
        <Label className="text-[11px] font-medium text-muted-foreground">{label}</Label>
        <div className="relative aspect-[3/2] rounded border border-border bg-muted overflow-hidden group">
          {url ? (
            <>
              <img src={url} alt={label} className="w-full h-full object-contain p-1" />
              <button
                type="button"
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                onClick={onClear}
                title="Remover"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-muted-foreground/10 transition-colors text-muted-foreground">
              {uploadingIrata === which ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ImagePlus className="w-4 h-4" />
                  <span className="text-[10px] mt-0.5 text-center px-1 leading-tight">Enviar logo</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingIrata !== null}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) handleIrataUpload(which, file);
                }}
              />
            </label>
          )}
        </div>
      </div>
    );
  };

  const addBlock = (type: ContentBlock['type']) => {
    if (!selectedSection) return;
    const newBlock: ContentBlock = { id: crypto.randomUUID(), type, text: '' };
    onSectionContentChange(selectedSection.id, [...selectedSection.content, newBlock]);
  };

  const removeBlock = (blockId: string) => {
    if (!selectedSection) return;
    onSectionContentChange(
      selectedSection.id,
      selectedSection.content.filter((b) => b.id !== blockId)
    );
  };

  // ===== Reusable blocks =====
  const coverPhotosBlock = (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <ImageIcon className="w-3.5 h-3.5 text-foreground" />
        <Label className="text-sm font-semibold">Fotos da Capa</Label>
      </div>
      <p className="text-[11px] text-muted-foreground leading-tight">
        Até 4 fotos para o mosaico em losango da capa.
      </p>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full h-8 text-xs"
        onClick={() => setPickerOpen(true)}
        disabled={!projectId}
        title={!projectId ? 'Selecione um projeto para escolher fotos dos RDOs' : undefined}
      >
        <Sparkles className="w-3.5 h-3.5 mr-1.5" />
        Escolher dos RDOs
      </Button>

      <div className="grid grid-cols-2 gap-1.5">
        {[0, 1, 2, 3].map((slotIdx) => {
          const url = coverPhotos[slotIdx];
          return (
            <div
              key={slotIdx}
              className="relative aspect-square rounded border border-border overflow-hidden bg-muted group"
            >
              {url ? (
                <>
                  <img src={url} alt={`Foto ${slotIdx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={() => handleRemoveSlot(slotIdx)}
                    title="Remover"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-muted-foreground/10 transition-colors text-muted-foreground">
                  {uploadingSlot === slotIdx ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ImagePlus className="w-4 h-4" />
                      <span className="text-[10px] mt-0.5">Foto {slotIdx + 1}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingSlot !== null}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) handleSlotUpload(slotIdx, file);
                    }}
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>

      <CoverPhotoPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        projectId={projectId}
        startDate={startDate || null}
        endDate={endDate || null}
        currentUrls={coverPhotos}
        maxSelect={4}
        onApply={(urls) => {
          onCoverPhotosChange?.(urls.slice(0, 4));
          if (urls.length > 0) toast.success(`${urls.length} foto(s) aplicada(s) na capa`);
        }}
      />
    </div>
  );

  const irataBlock = (
    <div className="flex items-center justify-between py-1">
      <Label className="text-xs cursor-pointer">Mostrar logos da Certificadora</Label>
      <Switch
        checked={showIrataSeals}
        onCheckedChange={(v) => onShowIrataSealsChange?.(v)}
      />
    </div>
  );

  const reportMetadataBlock = (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-semibold text-foreground hover:text-primary transition-colors">
        <Settings2 className="w-3.5 h-3.5" />
        <span className="flex-1 text-left">Dados do Relatório</span>
        <ChevronDown className="w-3.5 h-3.5" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 pt-2">
          <div>
            <Label className="text-xs">Unidade</Label>
            <Select value={siteId} onValueChange={onSiteChange}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {sites?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Projeto</Label>
            <Select value={projectId} onValueChange={onProjectChange} disabled={!siteId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {siteProjects?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Código</Label>
            <Input value={code} onChange={(e) => onFieldChange('code', e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Cliente</Label>
            <Input value={clientName} onChange={(e) => onFieldChange('clientName', e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Unidade do Cliente</Label>
            <Input value={clientUnit} onChange={(e) => onFieldChange('clientUnit', e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Contato</Label>
            <Input value={clientContact} onChange={(e) => onFieldChange('clientContact', e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Assunto</Label>
            <Input value={subject} onChange={(e) => onFieldChange('subject', e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Início</Label>
              <Input type="date" value={startDate} onChange={(e) => onFieldChange('startDate', e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Fim</Label>
              <Input type="date" value={endDate} onChange={(e) => onFieldChange('endDate', e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Conclusão</Label>
            <Textarea value={conclusion} onChange={(e) => onFieldChange('conclusion', e.target.value)} className="text-sm min-h-[80px]" />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );

  const sectionBlock = selectedSection && (
    <div className="space-y-3">
      {/* Sticky contextual header */}
      <div className="-mx-3 -mt-3 px-3 pt-3 pb-2.5 bg-primary/5 border-b border-primary/20 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          {onClearSelection && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0"
              onClick={onClearSelection}
              title="Voltar para a capa"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
          <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-[10px] font-bold tracking-[0.15em] text-primary uppercase">Editando Seção</span>
        </div>
        <div className="flex items-center gap-2 mt-1.5 pl-9">
          <span className="text-sm font-bold text-foreground truncate flex-1">
            {selectedSection.title || 'Sem título'}
          </span>
          <span className="text-[10px] uppercase tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded shrink-0">
            {sectionTypeLabels[selectedSection.sectionType] || selectedSection.sectionType}
          </span>
        </div>
      </div>

      {/* Photos FIRST — most likely what user wants when clicking a photo */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Fotos da Seção</Label>
          {!['scope', 'safety', 'execution', 'conclusion'].includes(selectedSection.sectionType) && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => onSectionDelete(selectedSection.id)} title="Excluir seção">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        <PhotoBlockEditor
          sectionId={selectedSection.id}
          photos={selectedSection.photos}
          onChange={(photos) => onSectionPhotosChange(selectedSection.id, photos)}
          activePhotoId={activePhotoId}
        />
      </div>

      <Separator />

      {/* Section title + type */}
      <div>
        <Label className="text-xs">Título</Label>
        <Input
          value={selectedSection.title}
          onChange={(e) => onSectionTitleChange(selectedSection.id, e.target.value)}
          className="h-9 text-sm font-medium"
        />
      </div>
      <div>
        <Label className="text-xs">Tipo</Label>
        <Select value={selectedSection.sectionType} onValueChange={(v) => onSectionTypeChange(selectedSection.id, v)}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(sectionTypeLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Content blocks */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Blocos de Conteúdo</Label>
        {selectedSection.content.map((block) => {
          const plainText = block.text.replace(/<[^>]*>/g, '').trim();
          const typeLabel = block.type === 'heading' ? 'H' : block.type === 'list' ? 'L' : 'P';
          return (
            <div key={block.id} className="flex items-center gap-1.5 group">
              <span className="shrink-0 w-6 h-6 rounded bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold">
                {typeLabel}
              </span>
              <p className="flex-1 text-xs text-foreground truncate min-w-0" title={plainText || 'Vazio'}>
                {plainText || <span className="text-muted-foreground italic">Edite no preview</span>}
              </p>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive opacity-0 group-hover:opacity-100 shrink-0" onClick={() => removeBlock(block.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          );
        })}
        <div className="grid grid-cols-3 gap-1.5">
          <Button variant="outline" size="sm" onClick={() => addBlock('paragraph')} className="text-xs h-8 px-2">+ Texto</Button>
          <Button variant="outline" size="sm" onClick={() => addBlock('heading')} className="text-xs h-8 px-2">+ Título</Button>
          <Button variant="outline" size="sm" onClick={() => addBlock('list')} className="text-xs h-8 px-2">+ Lista</Button>
        </div>
      </div>
    </div>
  );

  // ===== Render: Mode A (section selected) or Mode B (cover) =====
  return (
    <ScrollArea className="w-64 border-l border-border bg-card shrink-0">
      <div className="p-3 space-y-4">
        {selectedSection ? (
          <>
            {sectionBlock}

            {/* Cover/IRATA/Report data — collapsed at the bottom */}
            <Separator />
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                <ImageIcon className="w-4 h-4" />
                <span className="flex-1 text-left">Capa & Dados do Relatório</span>
                <ChevronDown className="w-4 h-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-3 pt-3">
                  {coverPhotosBlock}
                  {irataBlock}
                  <Separator />
                  {reportMetadataBlock}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        ) : (
          <>
            {coverPhotosBlock}
            {irataBlock}
            <Separator />
            {reportMetadataBlock}
          </>
        )}
      </div>
    </ScrollArea>
  );
}

