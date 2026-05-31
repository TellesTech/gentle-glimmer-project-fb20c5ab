import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search, Factory, Building2, Loader2, CheckCheck, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CompanyWithSites {
  id: string;
  name: string;
  sites: { id: string; name: string }[];
}

interface SiteAccessSelectorProps {
  selectedSiteIds: Set<string>;
  onChange: (next: Set<string>) => void;
}

export function SiteAccessSelector({ selectedSiteIds, onChange }: SiteAccessSelectorProps) {
  const [companies, setCompanies] = useState<CompanyWithSites[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('companies')
        .select('id, name, sites(id, name)')
        .order('name');
      if (!mounted) return;
      const list: CompanyWithSites[] = (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        sites: ((c.sites || []) as any[])
          .map(s => ({ id: s.id, name: s.name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      })).filter(c => c.sites.length > 0);
      setCompanies(list);
      // Auto-expand companies that already have selections
      const auto = new Set<string>();
      list.forEach(c => {
        if (c.sites.some(s => selectedSiteIds.has(s.id))) auto.add(c.id);
      });
      setExpanded(auto);
      setLoading(false);
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return companies;
    return companies
      .map(c => ({
        ...c,
        sites: c.sites.filter(s =>
          s.name.toLowerCase().includes(term) || c.name.toLowerCase().includes(term)
        ),
      }))
      .filter(c => c.sites.length > 0);
  }, [companies, search]);

  const allSiteIds = useMemo(() => companies.flatMap(c => c.sites.map(s => s.id)), [companies]);

  const toggleSite = (siteId: string) => {
    const next = new Set(selectedSiteIds);
    if (next.has(siteId)) next.delete(siteId);
    else next.add(siteId);
    onChange(next);
  };

  const toggleCompany = (company: CompanyWithSites) => {
    const next = new Set(selectedSiteIds);
    const companySiteIds = company.sites.map(s => s.id);
    const allSelected = companySiteIds.every(id => next.has(id));
    if (allSelected) companySiteIds.forEach(id => next.delete(id));
    else companySiteIds.forEach(id => next.add(id));
    onChange(next);
  };

  const toggleExpanded = (companyId: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(companyId)) n.delete(companyId);
      else n.add(companyId);
      return n;
    });
  };

  const selectAll = () => onChange(new Set(allSiteIds));
  const clearAll = () => onChange(new Set());

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Carregando fábricas…
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/20">
      {/* Header */}
      <div className="p-3 border-b bg-muted/30 space-y-2">
        <div className="flex items-center gap-2">
          <Factory className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Fábricas com acesso</span>
          <Badge variant={selectedSiteIds.size > 0 ? 'default' : 'secondary'} className="ml-auto h-5 text-[10px]">
            {selectedSiteIds.size} selecionada{selectedSiteIds.size !== 1 ? 's' : ''}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar fábrica..."
              className="h-8 pl-7 text-xs"
            />
          </div>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={selectAll} title="Selecionar todas">
            <CheckCheck className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clearAll} title="Limpar seleção">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[280px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Nenhuma fábrica encontrada
          </div>
        ) : (
          filtered.map(company => {
            const isOpen = expanded.has(company.id) || !!search.trim();
            const companySelected = company.sites.filter(s => selectedSiteIds.has(s.id)).length;
            const allSelected = companySelected === company.sites.length && companySelected > 0;
            const someSelected = companySelected > 0 && !allSelected;
            return (
              <div key={company.id} className="border-b last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleExpanded(company.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/40 transition-colors text-left"
                >
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium flex-1 truncate">{company.name}</span>
                  {companySelected > 0 && (
                    <Badge variant={allSelected ? 'default' : 'secondary'} className="h-4 px-1.5 text-[10px]">
                      {companySelected}/{company.sites.length}
                    </Badge>
                  )}
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); toggleCompany(company); }}
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded hover:bg-background transition-colors",
                      someSelected && "text-primary"
                    )}
                  >
                    {allSelected ? 'desmarcar todas' : 'marcar todas'}
                  </span>
                </button>

                {isOpen && (
                  <div className="pl-9 pr-3 pb-2 space-y-1">
                    {company.sites.map(site => {
                      const checked = selectedSiteIds.has(site.id);
                      return (
                        <label
                          key={site.id}
                          className={cn(
                            "flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-background transition-colors",
                            checked && "bg-primary/5"
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleSite(site.id)}
                          />
                          <span className={cn("text-sm", checked && "font-medium")}>{site.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
