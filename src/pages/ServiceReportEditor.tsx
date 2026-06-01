import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Editor } from '@tiptap/react';
import type { CanvasTool } from '@/components/service-reports/InteractivePdfPage';
import { useIsMobile } from '@/hooks/use-mobile';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/loose-client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Skeleton } from '@/components/ui/skeleton';
import type { ContentBlock } from '@/components/service-reports/SectionEditor';
import type { PhotoItem } from '@/components/service-reports/PhotoBlockEditor';
import { InteractivePdfPage, type Annotation, paginateAllSections, PageHeader, PageFooter } from '@/components/service-reports/InteractivePdfPage';
import { PropertiesPanel } from '@/components/service-reports/PropertiesPanel';

import { FloatingToolbar } from '@/components/service-reports/editor/FloatingToolbar';
import { ServiceImageEditor } from '@/components/service-reports/editor/ServiceImageEditor';
import { compressImage } from '@/lib/imageCompression';
import { ArrowLeft, Save, Download, Sparkles, PanelRightClose, PanelRightOpen, Plus } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { generateServiceReportPdf } from '@/lib/generateServiceReportPdf';
import html2canvas from 'html2canvas';
import { AIReportGeneratorDialog } from '@/components/service-reports/AIReportGeneratorDialog';
import { useRdoCoverPhotos } from '@/hooks/useRdoCoverPhotos';
import { dedupeContentBlocks } from '@/lib/dedupeReportBlocks';
import { cn } from '@/lib/utils';

const SECTION_TYPES = [
  { type: 'scope', label: 'Escopo' },
  { type: 'execution', label: 'Execução' },
  { type: 'safety', label: 'Segurança' },
  { type: 'conclusion', label: 'Conclusão' },
  { type: 'custom', label: 'Personalizada' },
];

function AddSectionButton({ onAdd }: { onAdd: (type: string) => void }) {
  return (
    <div className="group flex items-center justify-center py-2 gap-2">
      <div className="flex-1 border-t border-dashed border-border/50 group-hover:border-border transition-colors" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            title="Inserir nova seção entre estas duas"
            className="h-7 px-2.5 rounded-full text-xs font-medium text-muted-foreground border border-dashed border-border bg-background hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors gap-1"
          >
            <Plus className="w-3 h-3" />
            <span>Adicionar seção</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="bottom">
          {SECTION_TYPES.map(({ type, label }) => (
            <DropdownMenuItem key={type} onClick={() => onAdd(type)} className="cursor-pointer text-xs">
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="flex-1 border-t border-dashed border-border/50 group-hover:border-border transition-colors" />
    </div>
  );
}

interface SectionState {
  id: string;
  title: string;
  sectionType: string;
  content: ContentBlock[];
  order_index: number;
  photos: PhotoItem[];
  annotations?: Annotation[];
}

export default function ServiceReportEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Report fields
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientUnit, setClientUnit] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [subject, setSubject] = useState('');
  const [scopeDescription, setScopeDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [safetyNotes, setSafetyNotes] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [status, setStatus] = useState('draft');
  const [code, setCode] = useState('');
  const [revision, setRevision] = useState(0);
  const [siteId, setSiteId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverPhotos, setCoverPhotos] = useState<string[]>([]);
  const [showIrataSeals, setShowIrataSeals] = useState<boolean>(true);
  const [irataLogoBrasilUrl, setIrataLogoBrasilUrl] = useState<string | null>(null);
  const [irataLogoInternationalUrl, setIrataLogoInternationalUrl] = useState<string | null>(null);
  const [sections, setSections] = useState<SectionState[]>([]);
  const [saving, setSaving] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<{ sectionId: string; photoId: string; url: string } | null>(null);
  const [editingPhotoSaving, setEditingPhotoSaving] = useState(false);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<SectionState[][]>([]);
  const [redoStack, setRedoStack] = useState<SectionState[][]>([]);
  const [zoom, setZoom] = useState(100);
  const isMobile = useIsMobile();
  const [showProperties, setShowProperties] = useState(window.innerWidth >= 1024);

  const [activeTool, setActiveTool] = useState<CanvasTool>('cursor');
  const [drawColor, setDrawColor] = useState('#ef4444');
  const [drawLineWidth, setDrawLineWidth] = useState(2);

  // Undo/Redo
  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-20), sections]);
    setRedoStack([]);
  }, [sections]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    setRedoStack((prev) => [...prev, sections]);
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setSections(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    setUndoStack((prev) => [...prev, sections]);
    const next = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    setSections(next);
  };

  // Fetch report
  const { data: report, isLoading } = useQuery({
    queryKey: ['service-report', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_reports')
        .select('*, sites:site_id(id, name), projects:project_id(id, name)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch sections with photos
  const { data: sectionsData } = useQuery({
    queryKey: ['service-report-sections', id],
    queryFn: async () => {
      const { data: sects, error } = await supabase
        .from('service_report_sections')
        .select('*')
        .eq('report_id', id!)
        .order('order_index');
      if (error) throw error;

      const sectionIds = (sects || []).map((s: any) => s.id);
      let photos: any[] = [];
      if (sectionIds.length > 0) {
        const { data: p } = await supabase
          .from('service_report_photos')
          .select('*')
          .in('section_id', sectionIds)
          .order('order_index');
        photos = p || [];
      }

      return (sects || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        sectionType: s.section_type,
        content: (Array.isArray(s.content) ? s.content : []) as ContentBlock[],
        order_index: s.order_index,
        photos: photos
          .filter((p: any) => p.section_id === s.id)
          .map((p: any) => ({
            id: p.id,
            url: p.url,
            caption: p.caption || '',
            layout: p.layout || 'half',
            order_index: p.order_index,
            widthPercent: p.width_percent ?? (p.layout === 'full' ? 100 : 50),
            customHeight: p.custom_height ?? undefined,
            objectFit: p.object_fit ?? 'contain',
          })),
        annotations: Array.isArray(s.annotations) ? s.annotations : [],
      }));
    },
    enabled: !!id,
  });

  // Fetch sites
  const { data: sites } = useQuery({
    queryKey: ['sites-list-full', profile?.company_id],
    queryFn: async () => {
      const query = supabase
        .from('sites')
        .select('id, name, city, state, companies(name, responsible_name, responsible_email)')
        .order('name');
      if (profile?.company_id) query.eq('company_id', profile.company_id);
      const { data } = await query;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch projects for selected site
  const { data: siteProjects } = useQuery({
    queryKey: ['site-projects-editor', siteId],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name, start_date, end_date, description, progress')
        .eq('site_id', siteId)
        .order('name');
      return data || [];
    },
    enabled: !!siteId,
  });

  const handleSiteChange = (newSiteId: string) => {
    setSiteId(newSiteId);
    const site = sites?.find((s: any) => s.id === newSiteId);
    if (site) {
      const company = (site as any).companies;
      if (company && !clientName) setClientName(company.name || '');
      if (site.city && !clientUnit) setClientUnit(`${site.name} - ${site.city}${site.state ? `/${site.state}` : ''}`);
      if (company?.responsible_name && !clientContact) setClientContact(company.responsible_name);
    }
  };

  const handleProjectChange = (newProjectId: string) => {
    setProjectId(newProjectId);
    const proj = siteProjects?.find((p: any) => p.id === newProjectId);
    if (proj) {
      if (!subject) setSubject(proj.name || '');
      if (!startDate && proj.start_date) setStartDate(proj.start_date);
      if (!endDate && proj.end_date) setEndDate(proj.end_date);
      if (!title || title === 'Novo Relatório de Serviço') {
        setTitle(proj.name);
      }
    }
  };

  // Initialize state
  useEffect(() => {
    if (report) {
      setTitle(report.title || '');
      setClientName(report.client_name || '');
      setClientUnit(report.client_unit || '');
      setClientContact(report.client_contact || '');
      setSubject(report.subject || '');
      setScopeDescription(report.scope_description || '');
      setStartDate(report.start_date || '');
      setEndDate(report.end_date || '');
      setSafetyNotes(report.safety_notes || '');
      setConclusion(report.conclusion || '');
      setStatus(report.status || 'draft');
      setCode(report.code || '');
      setRevision(report.revision || 0);
      setSiteId(report.site_id || '');
      setProjectId(report.project_id || '');
      setCoverImageUrl((report as any).cover_image_url || null);
      const cp = (report as any).cover_photos;
      setCoverPhotos(Array.isArray(cp) ? cp.filter(Boolean) : []);
      setShowIrataSeals((report as any).show_irata_seals !== false);
      setIrataLogoBrasilUrl((report as any).irata_logo_brasil_url || null);
      setIrataLogoInternationalUrl((report as any).irata_logo_international_url || null);
    }
  }, [report]);

  useEffect(() => {
    if (sectionsData) {
      setSections(sectionsData.map((s) => ({ ...s, content: dedupeContentBlocks(s.content) })));
    }
  }, [sectionsData]);

  // Auto-suggest 4 cover photos from project's RDOs when the report has none yet.
  // Only runs after `report` is loaded and only if the saved cover_photos is empty.
  const reportHasNoSavedCover = !!report
    && (() => {
      const cp = (report as any).cover_photos;
      return !Array.isArray(cp) || cp.filter(Boolean).length === 0;
    })();
  const { photos: rdoSuggestedPhotos } = useRdoCoverPhotos({
    projectId,
    startDate: startDate || null,
    endDate: endDate || null,
    enabled: reportHasNoSavedCover && !!projectId,
    limit: 4,
  });
  const autoFilledRef = useRef(false);
  useEffect(() => {
    if (autoFilledRef.current) return;
    if (!reportHasNoSavedCover) return;
    if (coverPhotos.length > 0) return;
    if (rdoSuggestedPhotos.length === 0) return;
    autoFilledRef.current = true;
    setCoverPhotos(rdoSuggestedPhotos.slice(0, 4).map((p) => p.url));
  }, [rdoSuggestedPhotos, reportHasNoSavedCover, coverPhotos.length]);

  // Section operations
  const updateSection = (sectionId: string, updates: Partial<SectionState>) => {
    pushUndo();
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, ...updates } : s)));
  };

  const deleteSection = (sectionId: string) => {
    pushUndo();
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    if (selectedSectionId === sectionId) setSelectedSectionId(null);
  };

  const addSection = (atIndex?: number, sectionType?: string) => {
    pushUndo();
    const newId = crypto.randomUUID();
    const typeLabels: Record<string, string> = {
      scope: 'Escopo', execution: 'Execução', safety: 'Segurança',
      conclusion: 'Conclusão', custom: 'Nova Seção',
    };
    const type = sectionType || 'custom';
    const newSection: SectionState = {
      id: newId, title: typeLabels[type] || 'Nova Seção', sectionType: type,
      content: [], order_index: 0, photos: [], annotations: [],
    };
    setSections((prev) => {
      const idx = atIndex !== undefined ? atIndex : prev.length;
      const next = [...prev];
      next.splice(idx, 0, newSection);
      return next.map((s, i) => ({ ...s, order_index: i }));
    });
    setSelectedSectionId(newId);
  };

  // Handle inline edits from InteractivePdfPage
  const handleBlockEdit = (sectionId: string, blockId: string, text: string) => {
    if (blockId === '__title__') {
      updateSection(sectionId, { title: text });
    } else {
      const section = sections.find((s) => s.id === sectionId);
      if (section) {
        const nextContent = section.content.map((b) =>
          b.id === blockId ? { ...b, text } : b,
        );
        updateSection(sectionId, {
          content: dedupeContentBlocks(nextContent),
        });
      }
    }
  };

  const handleAnnotationsChange = (sectionId: string, annotations: Annotation[]) => {
    pushUndo();
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, annotations } : s)));
  };

  // Field change handler for PropertiesPanel
  const handleFieldChange = (field: string, value: string) => {
    const setters: Record<string, (v: string) => void> = {
      title: setTitle, clientName: setClientName, clientUnit: setClientUnit,
      clientContact: setClientContact, subject: setSubject, code: setCode,
      startDate: setStartDate, endDate: setEndDate, conclusion: setConclusion,
    };
    setters[field]?.(value);
  };

  // Image upload (from toolbar - requires selected section)
  const handleImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSectionId) {
      if (!selectedSectionId) toast.error('Selecione uma seção primeiro');
      return;
    }
    await uploadImageToSection(selectedSectionId, file);
    e.target.value = '';
  };

  // Image upload to specific section (from preview page)
  const handleImageUploadToSection = async (sectionId: string, file: File) => {
    await uploadImageToSection(sectionId, file);
  };

  const uploadImageToSection = async (sectionId: string, file: File) => {
    const ext = file.name.split('.').pop();
    const path = `${id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('service-report-photos').upload(path, file);
    if (error) {
      toast.error('Erro no upload: ' + error.message);
      return;
    }
    const { data: urlData } = supabase.storage.from('service-report-photos').getPublicUrl(path);
    const section = sections.find((s) => s.id === sectionId);
    if (section) {
      updateSection(sectionId, {
        photos: [...section.photos, { id: crypto.randomUUID(), url: urlData.publicUrl, caption: '', layout: 'half', order_index: section.photos.length }],
      });
    }
  };

  // Remove photo from section
  const handlePhotoRemove = (sectionId: string, photoId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    if (section) {
      pushUndo();
      updateSection(sectionId, {
        photos: section.photos.filter((p) => p.id !== photoId),
      });
    }
  };

  // Change photo layout (legacy compat)
  const handlePhotoLayoutChange = (sectionId: string, photoId: string, layout: 'half' | 'full') => {
    const section = sections.find((s) => s.id === sectionId);
    if (section) {
      pushUndo();
      updateSection(sectionId, {
        photos: section.photos.map((p) => p.id === photoId ? { ...p, layout, widthPercent: layout === 'full' ? 100 : 50 } : p),
      });
    }
  };

  // Resize photo (widthPercent + custom height) via drag
  const handlePhotoResize = (sectionId: string, photoId: string, widthPercent: number, customHeight?: number) => {
    const section = sections.find((s) => s.id === sectionId);
    if (section) {
      pushUndo();
      const layout = widthPercent > 60 ? 'full' : 'half';
      updateSection(sectionId, {
        photos: section.photos.map((p) => p.id === photoId ? { ...p, layout, widthPercent, customHeight: customHeight ?? p.customHeight } : p),
      });
    }
  };

  // Change photo caption
  const handlePhotoCaptionChange = (sectionId: string, photoId: string, caption: string) => {
    const section = sections.find((s) => s.id === sectionId);
    if (section) {
      pushUndo();
      updateSection(sectionId, {
        photos: section.photos.map((p) => p.id === photoId ? { ...p, caption } : p),
      });
    }
  };

  // Reorder photos
  const handlePhotoReorder = (sectionId: string, fromIndex: number, toIndex: number) => {
    const section = sections.find((s) => s.id === sectionId);
    if (section) {
      pushUndo();
      const photos = [...section.photos];
      const [moved] = photos.splice(fromIndex, 1);
      photos.splice(toIndex, 0, moved);
      updateSection(sectionId, { photos });
    }
  };

  // Toggle photo objectFit
  const handlePhotoObjectFitChange = (sectionId: string, photoId: string, fit: 'cover' | 'contain') => {
    const section = sections.find((s) => s.id === sectionId);
    if (section) {
      pushUndo();
      updateSection(sectionId, {
        photos: section.photos.map((p) => p.id === photoId ? { ...p, objectFit: fit } : p),
      });
    }
  };

  /** Force the focused editor (if any) to commit its current draft to state. */
  const flushActiveEditor = useCallback(async () => {
    const ed: any = activeEditor;
    if (ed && typeof ed.__commitDraft === 'function') {
      try { ed.__commitDraft(); } catch { /* ignore */ }
      // Blur to release focus, then yield so React can apply the setState.
      try { (document.activeElement as HTMLElement | null)?.blur?.(); } catch { /* ignore */ }
      await new Promise((r) => setTimeout(r, 30));
    }
  }, [activeEditor]);

  const handleSave = async () => {
    if (!id) return;
    await flushActiveEditor();
    setSaving(true);
    try {
      const { error: reportError } = await supabase
        .from('service_reports')
        .update({
          title, client_name: clientName, client_unit: clientUnit, client_contact: clientContact,
          subject, scope_description: scopeDescription, start_date: startDate || null,
          end_date: endDate || null, safety_notes: safetyNotes, conclusion,
          status: status as any, code, revision, site_id: siteId || null, project_id: projectId || null,
          cover_image_url: coverImageUrl,
          cover_photos: coverPhotos.length > 0 ? coverPhotos : null,
          show_irata_seals: showIrataSeals,
          irata_logo_brasil_url: irataLogoBrasilUrl,
          irata_logo_international_url: irataLogoInternationalUrl,
        } as any)
        .eq('id', id);
      if (reportError) throw reportError;

      for (const section of sections) {
        const { error: sectError } = await supabase
          .from('service_report_sections')
          .upsert({
            id: section.id, report_id: id, title: section.title,
            content: section.content as any, order_index: section.order_index,
            section_type: section.sectionType as any,
            annotations: (section.annotations || []) as any,
          });
        if (sectError) throw sectError;

        await supabase.from('service_report_photos').delete().eq('section_id', section.id);
        if (section.photos.length > 0) {
          const photoRows = section.photos.map((p, idx) => ({
            section_id: section.id, url: p.url, caption: p.caption,
            layout: p.layout as any, order_index: idx, annotations: [] as any,
            width_percent: p.widthPercent ?? 50, custom_height: p.customHeight ?? null,
            object_fit: p.objectFit ?? 'contain',
          }));
          const { error: photoError } = await supabase.from('service_report_photos').insert(photoRows);
          if (photoError) throw photoError;
        }
      }

      toast.success('Relatório salvo com sucesso');
      queryClient.invalidateQueries({ queryKey: ['service-report', id] });
      queryClient.invalidateQueries({ queryKey: ['service-report-sections', id] });
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err?.message || 'Tente novamente'));
    } finally {
      setSaving(false);
    }
  };

  const handleExportPdf = async () => {
    await flushActiveEditor();
    toast.info('Gerando PDF completo...');
    try {
      // Captura a capa exatamente como aparece no editor para garantir
      // paridade visual perfeita (logo, IRATA, fotos, metadados, rodapés).
      let coverRenderedImage: string | null = null;
      try {
        const coverEl = document.querySelector('[data-cover-page="true"]') as HTMLElement | null;
        if (coverEl) {
          // Neutraliza o zoom do editor durante a captura, restaurando depois.
          const scrollWrapper = coverEl.parentElement as HTMLElement | null;
          const prevTransform = scrollWrapper?.style.transform;
          if (scrollWrapper) scrollWrapper.style.transform = 'none';
          // Pequeno delay para o reflow assentar
          await new Promise((r) => setTimeout(r, 60));
          const canvas = await html2canvas(coverEl, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
          });
          coverRenderedImage = canvas.toDataURL('image/jpeg', 0.92);
          if (scrollWrapper) scrollWrapper.style.transform = prevTransform || '';
        }
      } catch (capErr) {
        console.warn('[handleExportPdf] cover capture failed', capErr);
      }

      const pdf = await generateServiceReportPdf({
        title, clientName, clientUnit, clientContact, subject, scopeDescription,
        startDate, endDate, safetyNotes, conclusion, code, revision, sections,
        coverImageUrl, coverPhotos, showIrataSeals,
        irataLogoBrasilUrl, irataLogoInternationalUrl,
        coverRenderedImage,
      });
      const safeName = (clientName || title || 'relatorio').replace(/[\\/:*?"<>|]/g, '-');
      const subjectPart = subject ? ` - ${subject.replace(/[\\/:*?"<>|]/g, '-')}` : '';
      pdf.save(`Relatório - ${safeName}${subjectPart}.pdf`);
      toast.success('PDF baixado com sucesso');
    } catch (err: any) {
      toast.error('Erro ao gerar PDF: ' + (err?.message || ''));
    }
  };

  const selectedSection = sections.find((s) => s.id === selectedSectionId) || null;

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />

      {/* Top toolbar */}
      <div className="flex items-center justify-between gap-3 p-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          {(() => {
            const siteFromList = (sites as any[] | undefined)?.find((s: any) => s.id === siteId)?.name;
            const projectFromList = (siteProjects as any[] | undefined)?.find((p: any) => p.id === projectId)?.name;
            const siteFromReport = (report as any)?.sites?.name;
            const projectFromReport = (report as any)?.projects?.name;
            const siteName = siteFromList || siteFromReport || clientUnit || '';
            const projectName = projectFromList || projectFromReport || subject || '';
            const headerLabel = [siteName, projectName].filter(Boolean).join(' — ') || title || 'Relatório de Serviço';
            return (
              <div className="flex-1 min-w-0 flex items-center px-2">
                <span className="font-semibold text-sm truncate" title={headerLabel}>
                  {headerLabel}
                </span>
              </div>
            );
          })()}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">


          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[110px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
              <SelectItem value="published">Publicado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1 h-7" onClick={handleExportPdf} title="Baixar PDF Completo (capa + seções + fotos + conclusão)">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs">Baixar PDF</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1 h-7" onClick={() => setAiDialogOpen(true)}>
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs">IA</span>
          </Button>
          <Button size="sm" className="gap-1 h-7" onClick={handleSave} disabled={saving}>
            <Save className="w-3.5 h-3.5" />
            <span className="text-xs">{saving ? 'Salvando...' : 'Salvar'}</span>
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowProperties(!showProperties)}>
            {showProperties ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center: Canvas area */}
        <div className="flex-1 relative overflow-hidden flex flex-col min-h-0">
          <FloatingToolbar
            editor={activeEditor}
            activeTool={activeTool}
            onToolChange={setActiveTool}
            onImageUpload={handleImageUpload}
            drawColor={drawColor}
            onDrawColorChange={setDrawColor}
            drawLineWidth={drawLineWidth}
            onDrawLineWidthChange={setDrawLineWidth}
            onAddPage={(type) => addSection(sections.length, type)}
          />
          <div ref={scrollContainerRef} className="flex-1 bg-muted/30 pb-24 overflow-y-auto relative min-h-0 pl-12">
            <div className="p-6 mx-auto space-y-6" style={{ maxWidth: `${Math.round(520 * zoom / 100)}px`, transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
              {/* Cover page */}
              <InteractivePdfPage
                type="cover"
                title={title}
                clientName={clientName}
                clientUnit={clientUnit}
                code={code}
                revision={revision}
                startDate={startDate}
                endDate={endDate}
                coverImageUrl={coverImageUrl}
                coverPhotos={coverPhotos}
                showIrataSeals={showIrataSeals}
                irataLogoBrasilUrl={irataLogoBrasilUrl}
                irataLogoInternationalUrl={irataLogoInternationalUrl}
                activeTool={activeTool}
                color={drawColor}
                lineWidth={drawLineWidth}
                selectedSectionId={selectedSectionId}
                onSelectSection={setSelectedSectionId}
                zoom={zoom}
                onTitleEdit={(v) => setClientName(v)}
                onEditorChange={setActiveEditor}
              />
              <AddSectionButton onAdd={(type) => addSection(0, type)} />

              {/* Section pages - multi-section per page */}
              {paginateAllSections(sections).map((page, pageIdx) => (
                <div key={pageIdx}>
                  <div className="bg-card border rounded shadow-sm aspect-[210/297] p-5 flex flex-col relative overflow-hidden transition-all">
                    <PageHeader code={code} revision={revision} />
                    <div className="flex-1 overflow-hidden space-y-3">
                      {page.map((slot) => (
                        <InteractivePdfPage
                          key={`${slot.section.id}-${slot.isContinuation ? 'c' : 'm'}`}
                          embedded
                          type="section"
                          section={slot.section}
                          sectionIndex={slot.sectionIndex}
                          code={code}
                          revision={revision}
                          zoom={zoom}
                          activeTool={activeTool}
                          color={drawColor}
                          lineWidth={drawLineWidth}
                          selectedSectionId={selectedSectionId}
                          activePhotoId={activePhotoId}
                          onSelectSection={(id) => {
                            setSelectedSectionId(id);
                            setActivePhotoId(null);
                          }}
                          onBlockEdit={handleBlockEdit}
                          onAnnotationsChange={handleAnnotationsChange}
                          onImageUpload={handleImageUploadToSection}
                          onPhotoRemove={handlePhotoRemove}
                          onPhotoResize={handlePhotoResize}
                          onPhotoCaptionChange={handlePhotoCaptionChange}
                          onPhotoReorder={handlePhotoReorder}
                          onPhotoObjectFitChange={handlePhotoObjectFitChange}
                          onPhotoClick={(sectionId, photoId) => {
                            setSelectedSectionId(sectionId);
                            setActivePhotoId(photoId);
                          }}
                          onEditPhoto={(sectionId, photoId) => {
                            const sec = sections.find((s) => s.id === sectionId);
                            const ph = sec?.photos.find((p) => p.id === photoId);
                            if (ph) {
                              setSelectedSectionId(sectionId);
                              setActivePhotoId(photoId);
                              setEditingPhoto({ sectionId, photoId, url: ph.url });
                            }
                          }}
                          onEditorChange={setActiveEditor}
                          photosSlice={slot.photosSlice}
                          isContinuation={slot.isContinuation}
                        />
                      ))}
                    </div>
                    <PageFooter />
                  </div>
                  {page.length > 0 && (
                    <AddSectionButton onAdd={(type) => addSection(page[page.length - 1].sectionIndex + 1, type)} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Properties Panel */}
        {showProperties && (
          <PropertiesPanel
            title={title}
            clientName={clientName}
            clientUnit={clientUnit}
            clientContact={clientContact}
            subject={subject}
            code={code}
            startDate={startDate}
            endDate={endDate}
            conclusion={conclusion}
            siteId={siteId}
            projectId={projectId}
            reportId={id}
            coverImageUrl={coverImageUrl}
            onCoverImageChange={setCoverImageUrl}
            coverPhotos={coverPhotos}
            onCoverPhotosChange={setCoverPhotos}
            showIrataSeals={showIrataSeals}
            onShowIrataSealsChange={setShowIrataSeals}
            irataLogoBrasilUrl={irataLogoBrasilUrl}
            onIrataLogoBrasilChange={setIrataLogoBrasilUrl}
            irataLogoInternationalUrl={irataLogoInternationalUrl}
            onIrataLogoInternationalChange={setIrataLogoInternationalUrl}
            sites={sites || []}
            siteProjects={siteProjects || []}
            onFieldChange={handleFieldChange}
            onSiteChange={handleSiteChange}
            onProjectChange={handleProjectChange}
            selectedSection={selectedSection}
            activePhotoId={activePhotoId}
            onClearSelection={() => {
              setSelectedSectionId(null);
              setActivePhotoId(null);
            }}
            onSectionTitleChange={(id, t) => updateSection(id, { title: t })}
            onSectionTypeChange={(id, t) => updateSection(id, { sectionType: t })}
            onSectionContentChange={(id, c) => updateSection(id, { content: c })}
            onSectionPhotosChange={(id, p) => updateSection(id, { photos: p })}
            onSectionDelete={deleteSection}
          />
        )}
      </div>
      <AIReportGeneratorDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        reportId={id}
        siteId={siteId}
        projectId={projectId}
        onGenerated={() => {
          queryClient.invalidateQueries({ queryKey: ['service-report', id] });
          queryClient.invalidateQueries({ queryKey: ['service-report-sections', id] });
        }}
      />

      {editingPhoto && (
        <ServiceImageEditor
          imageSrc={editingPhoto.url}
          open={true}
          onClose={() => {
            if (!editingPhotoSaving) setEditingPhoto(null);
          }}
          onApply={async (dataUrl) => {
            if (!editingPhoto || editingPhotoSaving) return;
            setEditingPhotoSaving(true);
            try {
              const response = await fetch(dataUrl);
              const blob = await response.blob();
              const fileName = `${editingPhoto.sectionId}/${crypto.randomUUID()}-edited.jpg`;
              const { error: uploadError } = await supabase.storage
                .from('service-report-photos')
                .upload(fileName, blob, { contentType: 'image/jpeg' });
              if (uploadError) {
                toast.error('Erro ao salvar foto editada');
                return;
              }
              const { data: urlData } = supabase.storage
                .from('service-report-photos')
                .getPublicUrl(fileName);
              const sec = sections.find((s) => s.id === editingPhoto.sectionId);
              if (sec) {
                updateSection(editingPhoto.sectionId, {
                  photos: sec.photos.map((p) =>
                    p.id === editingPhoto.photoId ? { ...p, url: urlData.publicUrl } : p
                  ),
                });
              }
              toast.success('Foto atualizada');
              setEditingPhoto(null);
            } catch {
              toast.error('Erro ao processar imagem');
            } finally {
              setEditingPhotoSaving(false);
            }
          }}
        />
      )}
    </div>
  );
}
