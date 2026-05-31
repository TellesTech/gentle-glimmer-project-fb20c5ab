import { Bot, Building2, Clock, Zap } from 'lucide-react';
import { totalAgents, totalDepartments } from './agentsData';

const stats = [
  { icon: Bot, label: 'Agentes Ativos', value: totalAgents.toString(), color: 'text-primary' },
  { icon: Building2, label: 'Departamentos', value: totalDepartments.toString(), color: 'text-blue-400' },
  { icon: Clock, label: 'Disponibilidade', value: '24/7', color: 'text-emerald-400' },
  { icon: Zap, label: 'Tempo Médio', value: '<2s', color: 'text-amber-400' },
];

export function AgentStats() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="rounded-xl border border-border/40 bg-card/80 backdrop-blur-sm p-4 text-center">
            <Icon className={`w-5 h-5 mx-auto mb-1.5 ${s.color}`} />
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        );
      })}
    </div>
  );
}
