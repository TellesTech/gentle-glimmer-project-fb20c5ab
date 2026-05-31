import { useState } from 'react';
import { Bot, Brain, MessageSquare, PenTool, Users, Server, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { departments, totalAgents, totalDepartments, totalByType } from '@/components/agents/agentsData';
import { AgentCard } from '@/components/agents/AgentCard';
import { AgentStats } from '@/components/agents/AgentStats';

const deptIcons: Record<string, React.ElementType> = {
  ai: Brain,
  communication: MessageSquare,
  signatures: PenTool,
  hr: Users,
  infra: Server,
  security: Shield,
};

export default function SystemAgents() {
  const [filter, setFilter] = useState<string | null>(null);

  const filtered = filter ? departments.filter(d => d.id === filter) : departments;

  return (
    <div className="space-y-6 pb-24 lg:pb-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Bot className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Agentes do Sistema</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {totalAgents} processos automatizados em {totalDepartments} departamentos — {totalByType.ia} com inteligência artificial, {totalByType.automacao} automações e {totalByType.integracao} integrações trabalhando 24/7.
        </p>
      </div>

      <AgentStats />

      {/* Department filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter(null)}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
            !filter
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card/80 text-muted-foreground border-border/60 hover:text-foreground'
          )}
        >
          Todos
        </button>
        {departments.map((d) => {
          const Icon = deptIcons[d.id];
          return (
            <button
              key={d.id}
              onClick={() => setFilter(filter === d.id ? null : d.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                filter === d.id
                  ? `${d.bgLight} ${d.textColor} border-transparent`
                  : 'bg-card/80 text-muted-foreground border-border/60 hover:text-foreground'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {d.label}
            </button>
          );
        })}
      </div>

      {/* Agents grid by department */}
      {filtered.map((dept) => {
        const Icon = deptIcons[dept.id];
        return (
          <section key={dept.id}>
            <div className="flex items-center gap-2 mb-3">
              <div className={cn('p-1.5 rounded-lg', dept.bgLight)}>
                <Icon className={cn('w-4 h-4', dept.textColor)} />
              </div>
              <h2 className="text-base font-semibold text-foreground">{dept.label}</h2>
              <span className="text-xs text-muted-foreground">({dept.agents.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {dept.agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} department={dept} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
