import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Image as ImageIcon, Check } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRdoCoverPhotos } from "@/hooks/useRdoCoverPhotos";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  /** Currently selected URLs (from cover) — pre-checked in the grid. */
  currentUrls?: string[];
  /** Max number of photos that can be applied. */
  maxSelect?: number;
  /** Called with up to maxSelect URLs when user confirms. */
  onApply: (urls: string[]) => void;
}

export function CoverPhotoPickerDialog({
  open, onOpenChange, projectId, startDate, endDate,
  currentUrls = [], maxSelect = 4, onApply,
}: Props) {
  const { photos, loading } = useRdoCoverPhotos({
    projectId, startDate, endDate, enabled: open, limit: 24,
  });

  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (open) setSelected(currentUrls.filter(Boolean).slice(0, maxSelect));
  }, [open, currentUrls, maxSelect]);

  const toggle = (url: string) => {
    setSelected((prev) => {
      if (prev.includes(url)) return prev.filter((u) => u !== url);
      if (prev.length >= maxSelect) return prev;
      return [...prev, url];
    });
  };

  const apply = () => {
    onApply(selected);
    onOpenChange(false);
  };

  const fmtDate = (d: string | null) => {
    if (!d) return "";
    try { return format(parseISO(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; }
  };

  const empty = !loading && photos.length === 0;

  const sortedPhotos = useMemo(() => photos, [photos]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Escolher fotos dos RDOs</DialogTitle>
          <DialogDescription>
            Selecione até {maxSelect} fotos para usar na capa do relatório.
            {startDate || endDate ? " Filtrado pelo período do relatório." : " Mostrando fotos recentes do projeto."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[280px]">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando fotos...
            </div>
          )}

          {empty && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-center">
              <ImageIcon className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">Nenhuma foto encontrada nos RDOs deste projeto{(startDate || endDate) ? " no período definido" : ""}.</p>
              <p className="text-xs mt-1">Você pode enviar as fotos manualmente nos slots da capa.</p>
            </div>
          )}

          {!loading && !empty && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[460px] overflow-y-auto pr-1">
              {sortedPhotos.map((p) => {
                const isSel = selected.includes(p.url);
                const order = isSel ? selected.indexOf(p.url) + 1 : null;
                return (
                  <button
                    key={p.url}
                    type="button"
                    onClick={() => toggle(p.url)}
                    className={cn(
                      "relative group aspect-square rounded-md overflow-hidden border-2 transition-all",
                      isSel ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
                    )}
                  >
                    <img src={p.url} alt={p.description || "Foto RDO"} className="w-full h-full object-cover" loading="lazy" />
                    {isSel && (
                      <div className="absolute top-1 right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-md">
                        {order}
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-[10px] text-white px-1.5 py-1 flex items-center justify-between">
                      <span className="truncate">
                        {p.rdoNumber != null ? `RDO #${p.rdoNumber}` : "RDO"}
                      </span>
                      <span className="opacity-80">{fmtDate(p.reportDate)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <span className="text-xs text-muted-foreground mr-auto self-center">
            {selected.length}/{maxSelect} selecionadas
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={apply} disabled={selected.length === 0}>
            <Check className="w-4 h-4 mr-1.5" /> Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
