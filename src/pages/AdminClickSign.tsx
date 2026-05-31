import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, isPast, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  FileSignature,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Eye,
  Mail,
  Ban,
  RefreshCw,
  Search,
  Filter,
  Users,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useClickSign } from '@/hooks/useClickSign';

interface ClickSignDocument {
  id: string;
  report_id: string;
  document_key: string | null;
  document_url: string | null;
  document_hash: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  signed_at: string | null;
  cancelled_at: string | null;
  created_by: string | null;
  metadata: Record<string, unknown> | null;
  report?: {
    id: string;
    date: string;
    project?: {
      id: string;
      name: string;
    };
  };
  signers?: ClickSignSigner[];
}

interface ClickSignSigner {
  id: string;
  document_id: string;
  signer_key: string | null;
  name: string;
  email: string;
  role: string | null;
  phone: string | null;
  status: string;
  signed_at: string | null;
  auth_method: string | null;
  ip_address: string | null;
}

type StatusFilter = 'all' | 'pending' | 'signed' | 'cancelled' | 'expired';
type PeriodFilter = '7' | '30' | '90' | 'all';

export default function AdminClickSign() {
  const navigate = useNavigate();
  const { role, isLoading: authLoading } = useAuth();
  const { cancelDocumentAsync, notifySignersAsync, isCancelling, isNotifying } = useClickSign();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('30');
  const [selectedDocument, setSelectedDocument] = useState<ClickSignDocument | null>(null);
  const [cancellingDocument, setCancellingDocument] = useState<ClickSignDocument | null>(null);

  // Redirect if not admin/director
  if (!authLoading && role && !['admin', 'super_admin'].includes(role)) {
    navigate('/');
    return null;
  }

  // Fetch all ClickSign documents with signers
  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ['clicksign-documents', periodFilter],
    queryFn: async () => {
      let query = supabase
        .from('clicksign_documents')
        .select(`
          *,
          report:reports(
            id,
            date,
            project:projects(id, name)
          )
        `)
        .order('created_at', { ascending: false });

      // Apply period filter
      if (periodFilter !== 'all') {
        const daysAgo = subDays(new Date(), parseInt(periodFilter));
        query = query.gte('created_at', daysAgo.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch signers for each document
      const documentsWithSigners = await Promise.all(
        (data || []).map(async (doc) => {
          const { data: signers } = await supabase
            .from('clicksign_signers')
            .select('*')
            .eq('document_id', doc.id);
          return { ...doc, signers: signers || [] };
        })
      );

      return documentsWithSigners as ClickSignDocument[];
    },
  });

  // Filter documents based on search and status
  const filteredDocuments = documents?.filter((doc) => {
    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'expired') {
        if (doc.status !== 'expired' && !(doc.expires_at && isPast(parseISO(doc.expires_at)) && doc.status === 'pending')) {
          return false;
        }
      } else if (doc.status !== statusFilter) {
        return false;
      }
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const projectName = doc.report?.project?.name?.toLowerCase() || '';
      const signerNames = doc.signers?.map(s => s.name.toLowerCase()).join(' ') || '';
      const signerEmails = doc.signers?.map(s => s.email.toLowerCase()).join(' ') || '';
      
      return projectName.includes(searchLower) || 
             signerNames.includes(searchLower) || 
             signerEmails.includes(searchLower);
    }

    return true;
  });

  // Calculate stats
  const stats = {
    total: documents?.length || 0,
    signed: documents?.filter(d => d.status === 'signed').length || 0,
    pending: documents?.filter(d => d.status === 'pending' || d.status === 'sent').length || 0,
    cancelled: documents?.filter(d => d.status === 'cancelled').length || 0,
    expired: documents?.filter(d => 
      d.status === 'expired' || (d.expires_at && isPast(parseISO(d.expires_at)) && d.status !== 'signed')
    ).length || 0,
  };

  const getStatusBadge = (doc: ClickSignDocument) => {
    const isExpired = doc.expires_at && isPast(parseISO(doc.expires_at)) && doc.status !== 'signed';
    
    if (doc.status === 'signed') {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Assinado</Badge>;
    }
    if (doc.status === 'cancelled') {
      return <Badge variant="destructive"><Ban className="w-3 h-3 mr-1" /> Cancelado</Badge>;
    }
    if (isExpired || doc.status === 'expired') {
      return <Badge variant="outline" className="border-orange-500 text-orange-600"><AlertTriangle className="w-3 h-3 mr-1" /> Expirado</Badge>;
    }
    return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
  };

  const getSignerProgress = (doc: ClickSignDocument) => {
    if (!doc.signers?.length) return null;
    const signed = doc.signers.filter(s => s.status === 'signed').length;
    return (
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">
          {signed}/{doc.signers.length}
        </span>
      </div>
    );
  };

  const handleCancel = async () => {
    if (!cancellingDocument?.document_key) return;
    
    try {
      await cancelDocumentAsync(cancellingDocument.document_key);
      toast.success('Documento cancelado com sucesso');
      setCancellingDocument(null);
      refetch();
    } catch {
      toast.error('Erro ao cancelar documento');
    }
  };

  const handleNotify = async (doc: ClickSignDocument) => {
    if (!doc.document_key) return;
    
    try {
      await notifySignersAsync({ documentKey: doc.document_key });
      toast.success('Lembretes enviados com sucesso');
    } catch {
      toast.error('Erro ao enviar lembretes');
    }
  };

  if (authLoading) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 xs:p-4 space-y-4 sm:space-y-6 min-w-0">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="w-fit">
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl xs:text-2xl font-bold flex items-center gap-2">
            <FileSignature className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
            <span className="truncate">Autentique - Documentos</span>
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie documentos enviados para assinatura digital</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xs:grid-cols-3 lg:grid-cols-5 gap-2 xs:gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 xs:p-4">
            <div className="flex items-center gap-2 xs:gap-3">
              <div className="p-1.5 xs:p-2 rounded-lg bg-muted">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg xs:text-2xl font-bold">{stats.total}</p>
                <p className="text-[10px] xs:text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 xs:p-4">
            <div className="flex items-center gap-2 xs:gap-3">
              <div className="p-1.5 xs:p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-lg xs:text-2xl font-bold text-green-600">{stats.signed}</p>
                <p className="text-[10px] xs:text-xs text-muted-foreground">Assinados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 xs:p-4">
            <div className="flex items-center gap-2 xs:gap-3">
              <div className="p-1.5 xs:p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900">
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-lg xs:text-2xl font-bold text-yellow-600">{stats.pending}</p>
                <p className="text-[10px] xs:text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 xs:p-4">
            <div className="flex items-center gap-2 xs:gap-3">
              <div className="p-1.5 xs:p-2 rounded-lg bg-destructive/10">
                <Ban className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-lg xs:text-2xl font-bold text-destructive">{stats.cancelled}</p>
                <p className="text-[10px] xs:text-xs text-muted-foreground">Cancelados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 xs:p-4">
            <div className="flex items-center gap-2 xs:gap-3">
              <div className="p-1.5 xs:p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-lg xs:text-2xl font-bold text-orange-600">{stats.expired}</p>
                <p className="text-[10px] xs:text-xs text-muted-foreground">Expirados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 xs:p-4 sm:pt-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por projeto, signatário ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <Filter className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="signed">Assinados</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                  <SelectItem value="expired">Expirados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="col-span-2 sm:col-span-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Documentos ({filteredDocuments?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : !filteredDocuments?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileSignature className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum documento encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Relatório</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Signatários</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="font-medium">
                          RDO {doc.report?.date && format(parseISO(doc.report.date), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {doc.report?.project?.name || 'Projeto não encontrado'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(parseISO(doc.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {doc.expires_at
                          ? format(parseISO(doc.expires_at), 'dd/MM/yyyy', { locale: ptBR })
                          : 'Sem prazo'}
                      </TableCell>
                      <TableCell>{getStatusBadge(doc)}</TableCell>
                      <TableCell>{getSignerProgress(doc)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedDocument(doc)}
                            title="Ver detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/reports/${doc.report_id}`)}
                            title="Ver relatório"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          {doc.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleNotify(doc)}
                                disabled={isNotifying}
                                title="Enviar lembretes"
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setCancellingDocument(doc)}
                                title="Cancelar documento"
                                className="text-destructive hover:text-destructive"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Details Dialog */}
      <Dialog open={!!selectedDocument} onOpenChange={() => setSelectedDocument(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              Detalhes do Documento
            </DialogTitle>
          </DialogHeader>
          {selectedDocument && (
            <div className="space-y-6">
              {/* Document Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Relatório</p>
                  <p className="font-medium">
                    RDO {selectedDocument.report?.date && format(parseISO(selectedDocument.report.date), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Projeto</p>
                  <p className="font-medium">{selectedDocument.report?.project?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedDocument)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Criado em</p>
                  <p className="font-medium">
                    {format(parseISO(selectedDocument.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </p>
                </div>
                {selectedDocument.expires_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Prazo</p>
                    <p className="font-medium">
                      {format(parseISO(selectedDocument.expires_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                )}
                {selectedDocument.signed_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Assinado em</p>
                    <p className="font-medium">
                      {format(parseISO(selectedDocument.signed_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </p>
                  </div>
                )}
                {selectedDocument.document_hash && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Hash do Documento</p>
                    <p className="font-mono text-xs break-all">{selectedDocument.document_hash}</p>
                  </div>
                )}
              </div>

              {/* Signers */}
              {selectedDocument.signers && selectedDocument.signers.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Signatários ({selectedDocument.signers.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedDocument.signers.map((signer) => (
                      <div
                        key={signer.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                      >
                        <div>
                          <p className="font-medium">{signer.name}</p>
                          <p className="text-sm text-muted-foreground">{signer.email}</p>
                          {signer.role && <p className="text-xs text-muted-foreground">{signer.role}</p>}
                        </div>
                        <div className="text-right">
                          {signer.status === 'signed' ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Assinado
                            </Badge>
                          ) : signer.status === 'refused' ? (
                            <Badge variant="destructive">
                              <XCircle className="w-3 h-3 mr-1" />
                              Recusado
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <Clock className="w-3 h-3 mr-1" />
                              Pendente
                            </Badge>
                          )}
                          {signer.signed_at && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(parseISO(signer.signed_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => navigate(`/reports/${selectedDocument.report_id}`)}>
                  <FileText className="h-4 w-4 mr-2" />
                  Ver Relatório
                </Button>
                {selectedDocument.status === 'pending' && (
                  <>
                    <Button variant="outline" onClick={() => handleNotify(selectedDocument)} disabled={isNotifying}>
                      <Mail className="h-4 w-4 mr-2" />
                      Enviar Lembretes
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setSelectedDocument(null);
                        setCancellingDocument(selectedDocument);
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancellingDocument} onOpenChange={() => setCancellingDocument(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá cancelar o documento de assinatura. Os signatários não poderão mais assinar este documento.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={isCancelling} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancelar Documento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
