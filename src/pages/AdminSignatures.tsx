import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, Search, Download, CheckCircle2, Clock, XCircle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ApproverRow {
  id: string;
  status: string;
  created_at: string;
  signed_at: string | null;
  contact: {
    id: string;
    name: string;
    email: string;
    company?: { name: string } | null;
  } | null;
  report: {
    id: string;
    date: string;
    status: string;
    signed_pdf_url: string | null;
    project: {
      name: string;
      site?: { name: string; company?: { name: string } | null } | null;
    } | null;
  } | null;
}

const statusMeta: Record<string, { label: string; icon: any; className: string }> = {
  pending: { label: 'Pendente', icon: Clock, className: 'bg-amber-500/10 text-amber-700 border-amber-200' },
  approved: { label: 'Assinado', icon: CheckCircle2, className: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejeitado', icon: XCircle, className: 'bg-red-500/10 text-red-700 border-red-200' },
};

export default function AdminSignatures() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ApproverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('report_company_approvers')
        .select(`
          id,
          status,
          created_at,
          signed_at,
          contact:company_contacts (
            id,
            name,
            email,
            company:companies ( name )
          ),
          report:reports!inner (
            id,
            date,
            status,
            signed_pdf_url,
            project:projects (
              name,
              site:sites (
                name,
                company:companies ( name )
              )
            )
          )
        `)
        .order('created_at', { ascending: false });

      setRows((data as any) || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (tab !== 'all' && r.status !== tab) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.contact?.name?.toLowerCase().includes(q) ||
        r.contact?.email?.toLowerCase().includes(q) ||
        r.report?.project?.name?.toLowerCase().includes(q) ||
        r.report?.project?.site?.name?.toLowerCase().includes(q) ||
        r.report?.project?.site?.company?.name?.toLowerCase().includes(q)
      );
    });
  }, [rows, tab, search]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      pending: rows.filter((r) => r.status === 'pending').length,
      approved: rows.filter((r) => r.status === 'approved').length,
      rejected: rows.filter((r) => r.status === 'rejected').length,
    }),
    [rows],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Assinaturas de RDOs</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe todos os RDOs enviados aos clientes — pendentes, assinados e rejeitados.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total enviados</p>
          <p className="text-2xl font-bold">{counts.all}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Pendentes</p>
          <p className="text-2xl font-bold text-amber-600">{counts.pending}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Assinados</p>
          <p className="text-2xl font-bold text-emerald-600">{counts.approved}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Rejeitados</p>
          <p className="text-2xl font-bold text-red-600">{counts.rejected}</p>
        </Card>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="all">Todos ({counts.all})</TabsTrigger>
              <TabsTrigger value="pending">Pendentes ({counts.pending})</TabsTrigger>
              <TabsTrigger value="approved">Assinados ({counts.approved})</TabsTrigger>
              <TabsTrigger value="rejected">Rejeitados ({counts.rejected})</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, projeto, unidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum RDO encontrado.</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Projeto / Unidade</TableHead>
                  <TableHead>Data RDO</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead>Assinado em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const meta = statusMeta[r.status] || statusMeta.pending;
                  const Icon = meta.icon;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{r.contact?.name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{r.contact?.email}</div>
                        {r.contact?.company?.name && (
                          <div className="text-xs text-muted-foreground">{r.contact.company.name}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{r.report?.project?.name || '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.report?.project?.site?.name}
                          {r.report?.project?.site?.company?.name &&
                            ` • ${r.report.project.site.company.name}`}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.report?.date ? format(new Date(r.report.date), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(r.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.signed_at
                          ? format(new Date(r.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={meta.className}>
                          <Icon className="w-3 h-3 mr-1" />
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {r.report?.signed_pdf_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Baixar PDF assinado"
                              onClick={() => window.open(r.report!.signed_pdf_url!, '_blank')}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                          {r.report?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Abrir RDO"
                              onClick={() => navigate(`/reports/${r.report!.id}`)}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
