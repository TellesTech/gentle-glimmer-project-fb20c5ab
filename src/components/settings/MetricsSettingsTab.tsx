import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TabsContent } from '@/components/ui/tabs';
import { BarChart3, ExternalLink, Save } from 'lucide-react';
import { useImpactSettings, useUpdateImpactSettings, type ImpactSettings } from '@/hooks/useImpactMetrics';

export function MetricsSettingsTab() {
  const { data: settings, isLoading } = useImpactSettings();
  const updateSettings = useUpdateImpactSettings();
  const [editSettings, setEditSettings] = useState<Partial<ImpactSettings> | null>(null);

  const s = settings || {
    manual_time_per_rdo: 10,
    system_time_per_rdo: 1,
    hourly_salary: 25,
    document_search_time: 60,
    hh_calculation_time: 30,
  } as ImpactSettings;

  const handleSave = () => {
    if (!settings || !editSettings) return;
    updateSettings.mutate({ id: settings.id, ...editSettings });
    setEditSettings(null);
  };

  return (
    <TabsContent value="metrics" className="mt-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <CardTitle>Métricas de Impacto</CardTitle>
          </div>
          <CardDescription>
            Ajuste os parâmetros de cálculo usados nas métricas de impacto do sistema
          </CardDescription>
          <Button variant="outline" size="sm" asChild className="mt-2 w-fit">
            <Link to="/admin/impact">
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Ver Dashboard de Métricas
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tempo manual por RDO (minutos)</Label>
                  <Input
                    type="number"
                    value={editSettings?.manual_time_per_rdo ?? s.manual_time_per_rdo}
                    onChange={e => setEditSettings(prev => ({ ...prev, manual_time_per_rdo: Number(e.target.value) }))}
                  />
                  <p className="text-xs text-muted-foreground">Tempo médio para preencher um RDO manualmente</p>
                </div>
                <div className="space-y-2">
                  <Label>Tempo no sistema por RDO (minutos)</Label>
                  <Input
                    type="number"
                    value={editSettings?.system_time_per_rdo ?? s.system_time_per_rdo}
                    onChange={e => setEditSettings(prev => ({ ...prev, system_time_per_rdo: Number(e.target.value) }))}
                  />
                  <p className="text-xs text-muted-foreground">Tempo médio para preencher um RDO no sistema</p>
                </div>
                <div className="space-y-2">
                  <Label>Salário/hora (R$)</Label>
                  <Input
                    type="number"
                    value={editSettings?.hourly_salary ?? s.hourly_salary}
                    onChange={e => setEditSettings(prev => ({ ...prev, hourly_salary: Number(e.target.value) }))}
                  />
                  <p className="text-xs text-muted-foreground">Custo médio por hora do profissional</p>
                </div>
                <div className="space-y-2">
                  <Label>Tempo de busca de documentos (min)</Label>
                  <Input
                    type="number"
                    value={editSettings?.document_search_time ?? s.document_search_time}
                    onChange={e => setEditSettings(prev => ({ ...prev, document_search_time: Number(e.target.value) }))}
                  />
                  <p className="text-xs text-muted-foreground">Tempo gasto buscando documentos para fechar a atividade (WhatsApp + Excel)</p>
                </div>
                <div className="space-y-2">
                  <Label>Tempo para calcular HH por colaborador/mês (min)</Label>
                  <Input
                    type="number"
                    value={editSettings?.hh_calculation_time ?? s.hh_calculation_time}
                    onChange={e => setEditSettings(prev => ({ ...prev, hh_calculation_time: Number(e.target.value) }))}
                  />
                  <p className="text-xs text-muted-foreground">Tempo manual para fechar a planilha mensal de Homem-Hora de 1 colaborador (turnos + adicional + extras)</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={updateSettings.isPending || !editSettings}>
                  <Save className="h-4 w-4 mr-1.5" /> Salvar Parâmetros
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
