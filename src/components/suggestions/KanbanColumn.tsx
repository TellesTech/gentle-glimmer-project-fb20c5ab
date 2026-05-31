import { LucideIcon } from "lucide-react";
import { Droppable } from "@hello-pangea/dnd";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SuggestionCard } from "./SuggestionCard";
import { Suggestion, SuggestionStatus } from "@/hooks/useSuggestions";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  title: string;
  icon: LucideIcon;
  status: SuggestionStatus;
  suggestions: Suggestion[];
  onVote: (suggestionId: string, hasVoted: boolean) => void;
  onStatusChange?: (id: string, status: SuggestionStatus) => void;
  onDelete?: (id: string) => void;
  isAdmin?: boolean;
  canDrag?: boolean;
  className?: string;
}

const statusColors: Record<SuggestionStatus, string> = {
  backlog: "border-t-slate-500",
  em_analise: "border-t-blue-500",
  em_desenvolvimento: "border-t-amber-500",
  concluido: "border-t-green-500",
};

export function KanbanColumn({
  title,
  icon: Icon,
  status,
  suggestions,
  onVote,
  onStatusChange,
  onDelete,
  isAdmin = false,
  canDrag = false,
  className,
}: KanbanColumnProps) {
  return (
    <div
      className={cn(
        "flex flex-col bg-muted/30 rounded-lg border-t-4 overflow-hidden",
        statusColors[status],
        className
      )}
    >
      {/* Column Header - Fixed */}
      <div className="shrink-0 flex items-center gap-2 p-4 border-b bg-muted/50">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="ml-auto bg-background px-2 py-0.5 rounded-full text-xs font-medium">
          {suggestions.length}
        </span>
      </div>

      {/* Cards - Scrollable */}
      <Droppable droppableId={status} isDropDisabled={!canDrag}>
        {(provided, snapshot) => (
          <ScrollArea className="flex-1 min-h-0">
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                "p-3 min-h-[200px] transition-colors duration-200",
                snapshot.isDraggingOver && "bg-primary/10"
              )}
            >
              <div className="space-y-3">
                {suggestions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Nenhuma sugestão
                  </div>
                ) : (
                  suggestions.map((suggestion, index) => (
                    <SuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      index={index}
                      onVote={onVote}
                      onStatusChange={onStatusChange}
                      onDelete={onDelete}
                      isAdmin={isAdmin}
                      canDrag={canDrag}
                    />
                  ))
                )}
              </div>
              {provided.placeholder}
            </div>
          </ScrollArea>
        )}
      </Droppable>
    </div>
  );
}
