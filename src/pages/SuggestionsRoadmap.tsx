import { Inbox, Search, Hammer, CheckCircle, Lightbulb } from "lucide-react";
import confetti from "canvas-confetti";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { KanbanColumn, NewSuggestionDialog } from "@/components/suggestions";
import { useSuggestions, SuggestionStatus } from "@/hooks/useSuggestions";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

const columns: { status: SuggestionStatus; title: string; icon: typeof Inbox }[] = [
  { status: "backlog", title: "Backlog", icon: Inbox },
  { status: "em_analise", title: "Em Análise", icon: Search },
  { status: "em_desenvolvimento", title: "Em Desenvolvimento", icon: Hammer },
  { status: "concluido", title: "Concluído", icon: CheckCircle },
];

export default function SuggestionsRoadmap() {
  const { role } = useAuth();
  const {
    isLoading,
    createSuggestion,
    updateSuggestionStatus,
    deleteSuggestion,
    toggleVote,
    getSuggestionsByStatus,
  } = useSuggestions();

  const isAdmin = role === "admin" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";

  const handleVote = (suggestionId: string, hasVoted: boolean) => {
    toggleVote.mutate({ suggestionId, hasVoted });
  };

  const handleStatusChange = (id: string, status: SuggestionStatus) => {
    updateSuggestionStatus.mutate({ id, status });
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja remover esta sugestão?")) {
      deleteSuggestion.mutate(id);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // Drop inválido ou mesmo local
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    // Apenas super_admin pode mover via drag
    if (!isSuperAdmin) return;

    const newStatus = destination.droppableId as SuggestionStatus;
    
    // Dispara confete ao mover para "concluído"
    if (newStatus === "concluido") {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#16a34a', '#15803d', '#f59e0b', '#3b82f6']
      });
    }
    
    updateSuggestionStatus.mutate({ id: draggableId, status: newStatus });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[500px] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] lg:h-[calc(100vh-120px)] min-w-0">
      {/* Header - Fixed */}
      <div className="shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 shrink-0">
            <Lightbulb className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg xs:text-xl sm:text-2xl font-bold truncate">Roadmap de Sugestões</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              Vote nas melhorias que você mais deseja
            </p>
          </div>
        </div>

        <NewSuggestionDialog
          onSubmit={(data) => createSuggestion.mutate(data)}
          isLoading={createSuggestion.isPending}
        />
      </div>

      {/* Kanban Board - Scrollable area */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {columns.map((column) => (
            <KanbanColumn
              key={column.status}
              title={column.title}
              icon={column.icon}
              status={column.status}
              suggestions={getSuggestionsByStatus(column.status)}
              onVote={handleVote}
              onStatusChange={isAdmin ? handleStatusChange : undefined}
              onDelete={isAdmin ? handleDelete : undefined}
              isAdmin={isAdmin}
              canDrag={isSuperAdmin}
              className="h-full"
            />
          ))}
        </div>
      </DragDropContext>

      {/* Legend - Fixed at bottom */}
      <div className="shrink-0 flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground border-t pt-3 sm:pt-4 mt-4">
        <span className="font-medium">Legenda:</span>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-blue-500" />
          <span>Melhoria</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-red-500" />
          <span>Bug</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-green-500" />
          <span>Nova Func.</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-purple-500" />
          <span>Integração</span>
        </div>
      </div>
    </div>
  );
}
