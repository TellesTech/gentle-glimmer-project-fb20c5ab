import { Link } from 'react-router-dom';
import { MapPin, FolderKanban, ChevronRight, MoreVertical, Pencil, Trash2, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Site, Project } from '@/types';

const getPublicImageUrl = (url: string | undefined): string => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/company-photos/${url}`;
};

interface SiteCardProps {
  site: Site;
  projects: Project[];
  companyImage?: string;
  companyLogo?: string;
  onEdit?: (site: Site) => void;
  onDelete?: (site: Site) => void;
}

export function SiteCard({ site, projects, companyImage, companyLogo, onEdit, onDelete }: SiteCardProps) {
  const activeProjects = projects.filter(p => p.active && p.status !== 'completed');
  const inProgressProjects = projects.filter(p => p.status === 'in_progress');

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit?.(site);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(site);
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

      <Link to={`/sites/${site.id}`}>
        <Card className="overflow-hidden card-hover group cursor-pointer h-full">
          {/* Photo */}
          <div className="relative h-36 overflow-hidden">
            {site.photo ? (
              <img
                src={getPublicImageUrl(site.photo)}
                alt={site.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : companyImage ? (
              <>
                <img
                  src={getPublicImageUrl(companyImage)}
                  alt="Imagem da fábrica"
                  className="w-full h-full object-cover opacity-75 transition-transform duration-500 group-hover:scale-110"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <Badge className="absolute top-2 left-2 bg-white/80 text-foreground text-xs">
                  <Building2 className="h-3 w-3 mr-1" />
                  Fábrica
                </Badge>
              </>
            ) : companyLogo ? (
              <div className="w-full h-full bg-muted flex items-center justify-center p-4">
                <img
                  src={getPublicImageUrl(companyLogo)}
                  alt="Logo da fábrica"
                  className="max-h-20 max-w-[80%] object-contain opacity-80"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <Badge className="absolute top-2 left-2 bg-white/80 text-foreground text-xs">
                  <Building2 className="h-3 w-3 mr-1" />
                  Fábrica
                </Badge>
              </div>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <MapPin className="w-12 h-12 text-muted-foreground/50" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            {/* Badge de atividades */}
            <div className="absolute bottom-3 left-3 flex gap-2">
              <Badge variant="secondary" className="bg-white/90 text-foreground backdrop-blur-sm">
                <FolderKanban className="w-3 h-3 mr-1" />
                {activeProjects.length} {activeProjects.length === 1 ? 'atividade' : 'atividades'}
              </Badge>
              {inProgressProjects.length > 0 && (
                <Badge className="bg-success/90 text-success-foreground backdrop-blur-sm">
                  {inProgressProjects.length} em andamento
                </Badge>
              )}
            </div>
          </div>

          {/* Content */}
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                  {site.name}
                </h3>
                
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">
                    {site.city}, {site.state}
                  </span>
                </div>
              </div>
              
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
