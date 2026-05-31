import { Link } from 'react-router-dom';
import { FolderKanban, FileText, Calendar, ChevronRight, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProjectStatusBadge } from '@/components/shared';
import type { Project, Report } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const getPublicImageUrl = (url: string | undefined): string => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/company-photos/${url}`;
};

interface ProjectCardProps {
  project: Project;
  reports: Report[];
  onEdit?: (project: Project) => void;
  onDelete?: (project: Project) => void;
}

export function ProjectCard({ project, reports, onEdit, onDelete }: ProjectCardProps) {
  const recentReports = reports
    .filter(r => r.projectId === project.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).reverse();
  
  const lastReport = recentReports[0];
  const totalReports = recentReports.length;

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit?.(project);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(project);
  };

  return (
    <div className="relative h-full">
      {(onEdit || onDelete) && (
        <div className="absolute top-3 right-3 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 bg-white/90 backdrop-blur-sm hover:bg-white shadow-sm"
                onClick={(e) => e.preventDefault()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              {onEdit && (
                <DropdownMenuItem onClick={handleEditClick}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <Link to={`/projects/${project.id}`}>
        <Card className="overflow-hidden card-hover group cursor-pointer h-full">
          {/* Photo */}
          <div className="relative h-32 overflow-hidden">
            {project.photo ? (
              <img
                src={getPublicImageUrl(project.photo)}
                alt={project.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <FolderKanban className="w-12 h-12 text-muted-foreground/50" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            {/* Status badge */}
            <div className="absolute top-3 left-3">
              <ProjectStatusBadge status={project.status} />
            </div>

            {/* Reports count */}
            <div className="absolute bottom-3 left-3">
              <Badge variant="secondary" className="bg-white/90 text-foreground backdrop-blur-sm">
                <FileText className="w-3 h-3 mr-1" />
                {totalReports} {totalReports === 1 ? 'relatório' : 'relatórios'}
              </Badge>
            </div>
          </div>

          {/* Content */}
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                  {project.name}
                </h3>
                
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {project.code} • {project.location}
                </p>
                
                {lastReport && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    <span>
                      Último: {format(new Date(lastReport.date), "dd 'de' MMM", { locale: ptBR })}
                    </span>
                  </div>
                )}
              </div>
              
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
