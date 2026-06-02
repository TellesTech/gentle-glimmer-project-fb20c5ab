import { useState, useCallback } from 'react';
import ExcelJS from 'exceljs';
import { Upload, FileSpreadsheet, Loader2, AlertTriangle, Check, X, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { normalizeFunction } from '@/lib/jobFunctions';

interface Collaborator {
  nome: string;
  email: string;
  cargo: string;
  telefone: string;
  estado: string;
  isDuplicate: boolean;
  duplicateOf: string | null;
  warnings: string[];
  action: 'skip' | 'import';
}

interface ImportCollaboratorsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Step = 'upload' | 'selectSheet' | 'analyzing' | 'preview' | 'importing';

interface SheetInfo {
  name: string;
  rowCount: number;
  hidden: boolean;
}

export function ImportCollaboratorsDialog({ open, onOpenChange, onSuccess }: ImportCollaboratorsDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('upload');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [summary, setSummary] = useState<{ total: number; duplicates: number; withEmail: number; withPhone: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingWorkbook, setPendingWorkbook] = useState<ExcelJS.Workbook | null>(null);
  const [sheetOptions, setSheetOptions] = useState<SheetInfo[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [importProgress, setImportProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  const resetDialog = useCallback(() => {
    setStep('upload');
    setCollaborators([]);
    setSummary(null);
    setPendingWorkbook(null);
    setSheetOptions([]);
    setSelectedSheet('');
  }, []);

  const handleClose = useCallback((open: boolean) => {
    if (!open) {
      resetDialog();
    }
    onOpenChange(open);
  }, [onOpenChange, resetDialog]);

  const extractAndAnalyze = useCallback(async (workbook: ExcelJS.Workbook, sheetName?: string) => {
    try {
      setStep('analyzing');
      const sheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.worksheets[0];
      if (!sheet) {
        toast({ title: 'Aba não encontrada', variant: 'destructive' });
        setStep('upload');
        return;
      }

      const rawData: any[][] = [];
      sheet.eachRow((row) => {
        const rowValues: any[] = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          rowValues[colNumber - 1] = cell.value;
        });
        rawData.push(rowValues);
      });

      const filteredData = rawData.filter(row =>
        row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '')
      );

      if (filteredData.length < 2) {
        toast({ title: 'Aba vazia ou sem dados válidos', variant: 'destructive' });
        setStep('upload');
        return;
      }

      console.log('Sending data to AI for analysis...', { rows: filteredData.length });

      const response = await supabase.functions.invoke('import-collaborators', {
        body: { action: 'analyze', rawData: filteredData },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro de conexão');
      }
      if (!response.data?.success) {
        throw new Error(response.data?.error || response.data?.reason || 'Erro ao analisar planilha');
      }

      const result = response.data.data;
      const collabsWithSelection = (result.collaborators || []).map((c: any) => ({
        ...c,
        cargo: normalizeFunction(c.cargo) || c.cargo,
        action: c.isDuplicate ? 'skip' : 'import',
      }));

      setCollaborators(collabsWithSelection);
      setSummary(result.summary);
      setStep('preview');
    } catch (error) {
      console.error('Analyze error:', error);
      toast({
        title: 'Erro ao processar planilha',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setStep('upload');
    }
  }, [toast]);

  const parseFile = useCallback(async (file: File) => {
    try {
      setStep('analyzing');

      // Check session before calling the function
      const { data: sessionData } = await (supabase as any).auth.getSession();
      if (!sessionData?.session) {
        toast({ 
          title: 'Sessão expirada', 
          description: 'Faça login novamente para continuar',
          variant: 'destructive' 
        });
        setStep('upload');
        return;
      }

      const arrayBuffer = await file.arrayBuffer();
      
      try {
        const workbook = new ExcelJS.Workbook();
        
        // Check file extension to use correct reader
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (ext === '.csv') {
          // For CSV, read as text and parse
          const text = await file.text();
          const lines = text.split('\n').map(line => 
            line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
          );
          // Create a worksheet manually from CSV data
          const sheet = workbook.addWorksheet('Sheet1');
          lines.forEach((row, i) => {
            sheet.addRow(row);
          });
        } else {
          await workbook.xlsx.load(arrayBuffer);
        }

        const sheets = workbook.worksheets;
        if (sheets.length === 0) {
          toast({ title: 'Planilha vazia', variant: 'destructive' });
          setStep('upload');
          return;
        }

        if (sheets.length > 1) {
          const options: SheetInfo[] = sheets
            .map(s => ({
              name: s.name,
              rowCount: s.actualRowCount,
              hidden: (s as any).state && (s as any).state !== 'visible',
            }))
            .sort((a, b) => Number(a.hidden) - Number(b.hidden));
          setPendingWorkbook(workbook);
          setSheetOptions(options);
          setSelectedSheet(options[0].name);
          setStep('selectSheet');
          return;
        }

        await extractAndAnalyze(workbook);

      } catch (error) {
        console.error('Parse error:', error);
        toast({ 
          title: 'Erro ao processar planilha', 
          description: error instanceof Error ? error.message : 'Erro desconhecido',
          variant: 'destructive' 
        });
        setStep('upload');
      }

    } catch (error) {
      console.error('File parse error:', error);
      toast({ title: 'Erro ao processar arquivo', variant: 'destructive' });
      setStep('upload');
    }
  }, [toast, extractAndAnalyze]);

  const confirmSheetSelection = useCallback(async () => {
    if (!pendingWorkbook || !selectedSheet) return;
    await extractAndAnalyze(pendingWorkbook, selectedSheet);
  }, [pendingWorkbook, selectedSheet, extractAndAnalyze]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      const validTypes = ['.xlsx', '.xls', '.csv'];
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!validTypes.includes(ext)) {
        toast({ title: 'Formato inválido', description: 'Use arquivos .xlsx, .xls ou .csv', variant: 'destructive' });
        return;
      }
      parseFile(file);
    }
  }, [parseFile, toast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseFile(file);
    }
    // Reset input
    e.target.value = '';
  }, [parseFile]);

  const toggleSelection = useCallback((index: number) => {
    setCollaborators(prev => prev.map((c, i) =>
      i === index ? { ...c, action: c.action === 'import' ? 'skip' : 'import' } : c
    ));
  }, []);

  const setDuplicateAction = useCallback((index: number, action: 'skip' | 'import') => {
    setCollaborators(prev => prev.map((c, i) => (i === index ? { ...c, action } : c)));
  }, []);

  const selectAll = useCallback(() => {
    setCollaborators(prev => prev.map(c => ({ ...c, action: 'import' })));
  }, []);

  const deselectDuplicates = useCallback(() => {
    setCollaborators(prev => prev.map(c => (c.isDuplicate ? { ...c, action: 'skip' } : c)));
  }, []);

  const importAllDuplicates = useCallback(() => {
    setCollaborators(prev => prev.map(c => (c.isDuplicate ? { ...c, action: 'import' } : c)));
  }, []);

  const removeDuplicates = useCallback(() => {
    setCollaborators(prev => prev.filter(c => !c.isDuplicate));
  }, []);

  const handleImport = useCallback(async () => {
    const selected = collaborators.filter(c => c.action === 'import');
    if (selected.length === 0) {
      toast({ title: 'Selecione ao menos um colaborador', variant: 'destructive' });
      return;
    }

    setStep('importing');
    setImportProgress({ done: 0, total: selected.length });

    const CHUNK_SIZE = 25;
    const payload = selected.map(({ nome, email, cargo, telefone, estado }) => ({ nome, email, cargo, telefone, estado }));
    let totalImported = 0;
    const allErrors: string[] = [];

    try {
      for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
        const chunk = payload.slice(i, i + CHUNK_SIZE);
        try {
          const response = await supabase.functions.invoke('import-collaborators', {
            body: { action: 'import', collaborators: chunk },
          });

          if (response.error) {
            allErrors.push(`Lote ${Math.floor(i / CHUNK_SIZE) + 1}: ${response.error.message}`);
          } else if (!response.data?.success) {
            allErrors.push(`Lote ${Math.floor(i / CHUNK_SIZE) + 1}: ${response.data?.error || 'Erro desconhecido'}`);
          } else {
            totalImported += response.data.imported || 0;
            if (Array.isArray(response.data.errors)) {
              allErrors.push(...response.data.errors);
            }
          }
        } catch (chunkErr) {
          console.error('Chunk error:', chunkErr);
          allErrors.push(`Lote ${Math.floor(i / CHUNK_SIZE) + 1}: ${chunkErr instanceof Error ? chunkErr.message : 'Erro de rede'}`);
        }

        setImportProgress({ done: Math.min(i + CHUNK_SIZE, payload.length), total: payload.length });
      }

      toast({
        title: 'Importação concluída',
        description: `${totalImported} colaborador(es) importado(s)${allErrors.length > 0 ? `. ${allErrors.length} erro(s).` : '.'}`,
        variant: allErrors.length > 0 && totalImported === 0 ? 'destructive' : 'default',
      });

      handleClose(false);
      onSuccess();
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Erro na importação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setStep('preview');
    }
  }, [collaborators, toast, handleClose, onSuccess]);

  const selectedCount = collaborators.filter(c => c.action === 'import').length;
  const duplicateCount = collaborators.filter(c => c.isDuplicate).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Colaboradores
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Faça upload de uma planilha Excel ou CSV com os dados dos colaboradores'}
            {step === 'selectSheet' && 'A planilha possui várias abas. Escolha qual deseja importar.'}
            {step === 'analyzing' && 'Analisando planilha com inteligência artificial...'}
            {step === 'preview' && `${collaborators.length} colaborador(es) encontrado(s). Revise e selecione para importar.`}
            {step === 'importing' && 'Importando colaboradores...'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === 'upload' && (
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Arraste um arquivo aqui</h3>
              <p className="text-sm text-muted-foreground mb-4">ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mb-4">Formatos aceitos: .xlsx, .xls, .csv</p>
              <label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button variant="outline" asChild>
                  <span>Selecionar Arquivo</span>
                </Button>
              </label>
            </div>
          )}

          {(step === 'analyzing' || step === 'importing') && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">
                {step === 'analyzing'
                  ? 'A IA está organizando os dados...'
                  : `Importando ${importProgress.done} de ${importProgress.total} colaboradores...`}
              </p>
            </div>
          )}

          {step === 'selectSheet' && (
            <ScrollArea className="max-h-[400px] pr-2">
              <RadioGroup value={selectedSheet} onValueChange={setSelectedSheet} className="space-y-2">
                {sheetOptions.map((s) => (
                  <Label
                    key={s.name}
                    htmlFor={`sheet-${s.name}`}
                    className="flex items-center gap-3 border rounded-md p-3 cursor-pointer hover:bg-muted/50"
                  >
                    <RadioGroupItem value={s.name} id={`sheet-${s.name}`} />
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        {s.name}
                        {s.hidden && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Oculta</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{s.rowCount} linha(s)</div>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </ScrollArea>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1">
                  <Users className="h-3 w-3" />
                  {collaborators.length} encontrados
                </Badge>
                {duplicateCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {duplicateCount} duplicata(s)
                  </Badge>
                )}
                <Badge variant="secondary" className="gap-1">
                  <Check className="h-3 w-3" />
                  {selectedCount} selecionado(s)
                </Badge>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Selecionar Todos
                </Button>
                {duplicateCount > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={deselectDuplicates}>
                      Pular Duplicatas
                    </Button>
                    <Button variant="outline" size="sm" onClick={importAllDuplicates}>
                      Importar Duplicatas
                    </Button>
                    <Button variant="destructive" size="sm" onClick={removeDuplicates}>
                      Remover Duplicatas
                    </Button>
                  </>
                )}
              </div>

              {/* Table */}
              <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Filial</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collaborators.map((collab, index) => (
                      <TableRow 
                        key={index} 
                        className={collab.isDuplicate ? 'bg-destructive/5' : ''}
                      >
                        <TableCell>
                          {collab.isDuplicate ? null : (
                            <Checkbox
                              checked={collab.action === 'import'}
                              onCheckedChange={() => toggleSelection(index)}
                            />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>{collab.nome}</div>
                          {collab.isDuplicate && collab.duplicateOf && (
                            <div className="text-xs text-muted-foreground font-normal mt-0.5">
                              {collab.duplicateOf}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {collab.email || '-'}
                        </TableCell>
                        <TableCell>{collab.cargo || '-'}</TableCell>
                        <TableCell>
                          {collab.estado === 'joao-neiva-es' ? 'Espírito Santo' : 
                           collab.estado === 'pecem-ce' ? 'Ceará' : 
                           collab.estado || '-'}
                        </TableCell>
                        <TableCell>
                          {collab.isDuplicate ? (
                            <Select
                              value={collab.action}
                              onValueChange={(v) => setDuplicateAction(index, v as 'skip' | 'import')}
                            >
                              <SelectTrigger className="h-8 text-xs w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="skip">Pular</SelectItem>
                                <SelectItem value="import">Importar mesmo assim</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step === 'upload' && (
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
          )}
          {step === 'selectSheet' && (
            <>
              <Button variant="outline" onClick={resetDialog}>
                Cancelar
              </Button>
              <Button onClick={confirmSheetSelection} disabled={!selectedSheet}>
                Continuar
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={resetDialog}>
                <X className="h-4 w-4 mr-2" />
                Nova Planilha
              </Button>
              <Button onClick={handleImport} disabled={selectedCount === 0}>
                <Check className="h-4 w-4 mr-2" />
                Importar {selectedCount} Selecionado(s)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
