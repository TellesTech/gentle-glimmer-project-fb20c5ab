import { useState } from "react";
import { ThumbsUp, Trash2, User, Calendar, ArrowRight, GripVertical, Image as ImageIcon, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Draggable } from "@hello-pangea/dnd";
import { Suggestion, SuggestionStatus, SuggestionCategory, SuggestionPriority } from "@/hooks/useSuggestions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface SuggestionCardProps {
  suggestion: Suggestion;
  index: number;
  onVote: (suggestionId: string, hasVoted: boolean) => void;
  onStatusChange?: (id: string, status: SuggestionStatus) => void;
  onDelete?: (id: string) => void;
  isAdmin?: boolean;
  canDrag?: boolean;
}

const categoryConfig: Record<SuggestionCategory, { label: string; className: string }> = {
  melhoria: { label: "Melhoria", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  bug: { label: "Bug", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  nova_funcionalidade: { label: "Nova Funcionalidade", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  integracao: { label: "Integração", className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
};

const priorityConfig: Record<SuggestionPriority, { label: string; className: string }> = {
  baixa: { label: "Baixa", className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
  media: { label: "Média", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  alta: { label: "Alta", className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  critica: { label: "Crítica", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

const statusOrder: SuggestionStatus[] = ["backlog", "em_analise", "em_desenvolvimento", "concluido"];

export function SuggestionCard({
  suggestion,
  index,
  onVote,
  onStatusChange,
  onDelete,
  isAdmin = false,
  canDrag = false,
}: SuggestionCardProps) {
  const [imageOpen, setImageOpen] = useState(false);
  const category = categoryConfig[suggestion.category];
  const priority = priorityConfig[suggestion.priority];
  const currentStatusIndex = statusOrder.indexOf(suggestion.status);
  const nextStatus = statusOrder[currentStatusIndex + 1];

  return (
    <>
      <Draggable 
        draggableId={suggestion.id} 
        index={index}
        isDragDisabled={!canDrag}
      >
        {(provided, snapshot) => (
          <Card 
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...(canDrag ? provided.dragHandleProps : {})}
            className={cn(
              "group hover:shadow-md transition-all duration-200 animate-fade-in",
              snapshot.isDragging && "shadow-xl rotate-1 scale-105 z-50",
              canDrag && "cursor-grab active:cursor-grabbing hover:scale-[1.01]"
            )}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-medium text-sm line-clamp-2 flex-1">{suggestion.title}</h4>
                {isAdmin && onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => onDelete(suggestion.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* Screenshot Thumbnail */}
              {suggestion.screenshot_url && (
                <button
                  type="button"
                  onClick={() => setImageOpen(true)}
                  className="relative w-full h-24 rounded-md overflow-hidden border hover:border-primary transition-colors group/img"
                >
                  <img 
                    src={suggestion.screenshot_url} 
                    alt="Screenshot da sugestão" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-lg" />
                  </div>
                </button>
              )}

              {suggestion.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {suggestion.description}
                </p>
              )}

              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className={cn("text-xs", category.className)}>
                  {category.label}
                </Badge>
                <Badge variant="secondary" className={cn("text-xs", priority.className)}>
                  {priority.label}
                </Badge>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span className="truncate max-w-[100px]">{suggestion.author_name}</span>
                </div>
                
                <Button
                  variant={suggestion.user_voted ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-7 gap-1 text-xs transition-all",
                    suggestion.user_voted && "bg-primary"
                  )}
                  onClick={() => onVote(suggestion.id, suggestion.user_voted || false)}
                >
                  <ThumbsUp className={cn("h-3 w-3", suggestion.user_voted && "fill-current")} />
                  <span>{suggestion.votes_count}</span>
                </Button>
              </div>

              {isAdmin && nextStatus && onStatusChange && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full h-7 text-xs mt-2">
                      <ArrowRight className="h-3 w-3 mr-1" />
                      Mover para próxima etapa
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {statusOrder.slice(currentStatusIndex + 1).map((status) => (
                      <DropdownMenuItem
                        key={status}
                        onClick={() => onStatusChange(suggestion.id, status)}
                      >
                        {status === "em_analise" && "Em Análise"}
                        {status === "em_desenvolvimento" && "Em Desenvolvimento"}
                        {status === "concluido" && "Concluído"}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{format(new Date(suggestion.created_at), "dd MMM yyyy", { locale: ptBR })}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </Draggable>

      {/* Image Modal */}
      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">Screenshot da sugestão</DialogTitle>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setImageOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            {suggestion.screenshot_url && (
              <img 
                src={suggestion.screenshot_url} 
                alt="Screenshot da sugestão em tamanho completo" 
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
