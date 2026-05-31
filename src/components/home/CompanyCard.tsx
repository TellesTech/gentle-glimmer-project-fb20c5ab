import { Link } from 'react-router-dom';
import { Building2, MapPin, ChevronRight, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Company, Site } from '@/types';

const getPublicImageUrl = (url: string | undefined): string => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/company-photos/${url}`;
};

interface CompanyCardProps {
  company: Company;
  sites: Site[];
  onEdit?: (company: Company) => void;
  onDelete?: (company: Company) => void;
}

export function CompanyCard({ company, sites, onEdit, onDelete }: CompanyCardProps) {
  const activeSites = sites.filter(s => s.active);
  const uniqueStates = [...new Set(sites.map(s => s.state))];

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit?.(company);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(company);
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

      <Link to={`/companies/${company.id}`}>
        <Card className="overflow-hidden card-hover group cursor-pointer h-full">
          {/* Photo */}
          <div className="relative h-36 overflow-hidden">
            {company.photo ? (
              <img
                src={getPublicImageUrl(company.photo)}
                alt={company.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Building2 className="w-16 h-16 text-muted-foreground/50" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            {/* Logo overlay */}
            {company.logo && (
              <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-md">
                <img
                  src={getPublicImageUrl(company.logo)}
                  alt={`${company.name} logo`}
                  className="h-8 w-auto object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Badge de unidades */}
            <div className="absolute bottom-3 left-3">
              <Badge variant="secondary" className="bg-white/90 text-foreground backdrop-blur-sm text-sm font-medium">
                {activeSites.length} {activeSites.length === 1 ? 'unidade' : 'unidades'}
              </Badge>
            </div>
          </div>

          {/* Content */}
          <CardContent className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">
                  {company.name}
                </h3>
                
                {uniqueStates.length > 0 && (
                  <div className="flex items-center gap-1.5 text-base text-muted-foreground mt-1">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate font-medium">
                      {uniqueStates.join(', ')}
                    </span>
                  </div>
                )}
              </div>
              
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
