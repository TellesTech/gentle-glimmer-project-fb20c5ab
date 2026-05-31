import { Badge } from '@/components/ui/badge';
import { AgentAvatar } from './AgentAvatar';
import { type Agent, type Department, typeLabel } from './agentsData';
import { cn } from '@/lib/utils';

interface AgentCardProps {
  agent: Agent;
  department: Department;
}

export function AgentCard({ agent, department }: AgentCardProps) {
  return (
    <div className="group relative rounded-xl border border-border/40 bg-card/80 backdrop-blur-sm p-4 hover:shadow-lg hover:border-border transition-all duration-300 hover:-translate-y-0.5">
      <div className="flex items-start gap-3">
        <AgentAvatar
          initials={agent.initials}
          colorFrom={department.colorFrom}
          colorTo={department.colorTo}
          gender={agent.gender}
          avatarVariant={agent.avatarVariant}
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm leading-tight">{agent.name}</h3>
          <p className={cn('text-xs font-medium mt-0.5', department.textColor)}>{agent.role}</p>
        </div>
        <div className="flex-shrink-0">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Ativo
          </span>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{agent.description}</p>
      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', department.bgLight, department.textColor, 'border-transparent')}>
          {department.label}
        </Badge>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border/60 text-muted-foreground">
          {typeLabel[agent.type]}
        </Badge>
      </div>
    </div>
  );
}
