import type { ContentBlock } from './SectionEditor';
import type { PhotoItem } from './PhotoBlockEditor';
import { paginateAllSections } from './InteractivePdfPage';
import { formatSectionTitle } from '@/lib/sectionNumbering';

interface Section {
  id: string;
  title: string;
  sectionType: string;
  content: ContentBlock[];
  photos: PhotoItem[];
}

interface PdfPagePreviewProps {
  title: string;
  clientName: string;
  clientUnit: string;
  code: string;
  revision: number;
  sections: Section[];
  startDate?: string;
  endDate?: string;
}

function PageHeader({ code, revision }: { code: string; revision: number }) {
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

function PageFooter() {
  return (
    <div className="border-t border-muted-foreground/20 pt-1 mt-auto">
      <p className="text-[6px] text-muted-foreground text-center italic">
        Este documento é propriedade da WEES Engenharia e não pode ser reproduzido sem autorização.
      </p>
    </div>
  );
}

function SectionPage({
  section,
  sectionIndex,
  code,
  revision,
  photosSlice,
  isContinuation,
}: {
  section: Section;
  sectionIndex: number;
  code: string;
  revision: number;
  photosSlice: PhotoItem[];
  isContinuation: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded shadow-sm aspect-[210/297] p-5 flex flex-col relative overflow-hidden">
      <PageHeader code={code} revision={revision} />

      <div className="flex-1 overflow-hidden space-y-2">
        <h3 className="text-[10px] font-bold text-foreground uppercase">
          {formatSectionTitle(section.title, sectionIndex)}
          {isContinuation && (
            <span className="text-muted-foreground font-normal"> (continuação)</span>
          )}
        </h3>

        {!isContinuation && section.content.map((block) => (
          <div key={block.id}>
            {block.type === 'heading' && (
              <h4 className="text-[9px] font-semibold text-foreground">{block.text}</h4>
            )}
            {block.type === 'paragraph' && (
              <p className="text-[8px] text-muted-foreground leading-relaxed">{block.text}</p>
            )}
            {block.type === 'list' && (
              <ul className="text-[8px] text-muted-foreground space-y-0.5 pl-3">
                {block.text.split('\n').filter(Boolean).map((item, i) => (
                  <li key={i} className="list-disc">{item}</li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {photosSlice.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {photosSlice.map((photo) => {
              const widthPct = photo.widthPercent ?? (photo.layout === 'full' ? 100 : 50);
              return (
                <div key={photo.id} className="overflow-hidden rounded border border-border" style={{ width: `calc(${widthPct}% - 6px)` }}>
                  <img
                    src={photo.url}
                    alt={photo.caption}
                    className="w-full object-cover"
                    style={{ height: photo.customHeight ? `${Math.min(photo.customHeight, 180)}px` : '140px' }}
                  />
                  {photo.caption && (
                    <p className="text-[6px] text-center text-muted-foreground py-0.5 px-1 truncate">
                      {photo.caption}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PageFooter />
    </div>
  );
}

export function PdfPagePreview({
  title,
  clientName,
  clientUnit,
  code,
  revision,
  sections,
  startDate,
  endDate,
}: PdfPagePreviewProps) {
  return (
    <div className="space-y-4">
      {/* Cover page */}
      <div className="bg-card border border-border rounded shadow-sm aspect-[210/297] p-6 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
        <div className="relative z-10">
          <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-6">
            <span className="text-primary-foreground text-2xl font-bold">W</span>
          </div>
          <h2 className="text-center text-lg font-bold text-foreground mb-1">
            RELATÓRIO DE SERVIÇOS
          </h2>
          <div className="w-12 h-0.5 bg-primary mx-auto mb-4" />
        </div>
        <div className="relative z-10 text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">{clientName || 'Nome do Cliente'}</p>
          <p className="text-xs text-muted-foreground">{clientUnit || 'Unidade'}</p>
          <p className="text-xs text-muted-foreground font-medium mt-2">
            {title || 'Título do Relatório'}
          </p>
          {(startDate || endDate) && (
            <p className="text-[10px] text-muted-foreground">
              {startDate && `Início: ${startDate}`}
              {startDate && endDate && ' — '}
              {endDate && `Fim: ${endDate}`}
            </p>
          )}
        </div>
        <div className="relative z-10">
          <p className="text-[8px] text-muted-foreground text-center">
            {code || 'RS-000'} • Revisão {String(revision).padStart(2, '0')}
          </p>
        </div>
      </div>

      {/* Content pages with multi-section auto-pagination */}
      {paginateAllSections(sections).map((page, pageIdx) => (
        <div key={pageIdx} className="bg-card border border-border rounded shadow-sm aspect-[210/297] p-5 flex flex-col relative overflow-hidden">
          <PageHeader code={code} revision={revision} />
          <div className="flex-1 overflow-hidden space-y-3">
            {page.map((slot) => (
              <div key={`${slot.section.id}-${slot.isContinuation ? 'c' : 'm'}`}>
                <h3 className="text-[10px] font-bold text-foreground uppercase">
                  {formatSectionTitle(slot.section.title, slot.sectionIndex)}
                  {slot.isContinuation && (
                    <span className="text-muted-foreground font-normal"> (continuação)</span>
                  )}
                </h3>

                {slot.showText && slot.section.content.map((block) => (
                  <div key={block.id}>
                    {block.type === 'heading' && (
                      <h4 className="text-[9px] font-semibold text-foreground">{block.text}</h4>
                    )}
                    {block.type === 'paragraph' && (
                      <p className="text-[8px] text-muted-foreground leading-relaxed">{block.text}</p>
                    )}
                    {block.type === 'list' && (
                      <ul className="text-[8px] text-muted-foreground space-y-0.5 pl-3">
                        {block.text.split('\n').filter(Boolean).map((item, i) => (
                          <li key={i} className="list-disc">{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}

                {slot.photosSlice.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {slot.photosSlice.map((photo) => {
                      const widthPct = photo.widthPercent ?? (photo.layout === 'full' ? 100 : 50);
                      return (
                        <div key={photo.id} className="overflow-hidden rounded border border-border" style={{ width: `calc(${widthPct}% - 6px)` }}>
                          <img
                            src={photo.url}
                            alt={photo.caption}
                            className="w-full object-cover"
                            style={{ height: photo.customHeight ? `${Math.min(photo.customHeight, 180)}px` : '140px' }}
                          />
                          {photo.caption && (
                            <p className="text-[6px] text-center text-muted-foreground py-0.5 px-1 truncate">
                              {photo.caption}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
          <PageFooter />
        </div>
      ))}
    </div>
  );
}