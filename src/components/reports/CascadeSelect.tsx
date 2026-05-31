import { LucideIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface CascadeSelectItem {
  id: string;
  label: string;
  sublabel?: string;
  imageUrl?: string | null;
}

interface CascadeSelectProps<T> {
  label: string;
  icon: LucideIcon;
  iconColorClass: string;
  bgColorClass: string;
  placeholder: string;
  value: string | null;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  items: T[];
  renderItem: (item: T) => CascadeSelectItem;
}

export function CascadeSelect<T>({
  label,
  icon: Icon,
  iconColorClass,
  bgColorClass,
  placeholder,
  value,
  onValueChange,
  disabled,
  isLoading,
  items,
  renderItem,
}: CascadeSelectProps<T>) {
  const selectedItem = items.find(item => renderItem(item).id === value);
  const selectedRendered = selectedItem ? renderItem(selectedItem) : null;

  return (
    <div className="space-y-2">
      <Select 
        value={value || undefined} 
        onValueChange={onValueChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger 
          className={cn(
            "h-auto min-h-[160px] sm:min-h-[180px] p-3 sm:p-4 flex flex-col items-stretch transition-all duration-200",
            "border-2 rounded-xl",
            value 
              ? "border-primary/30 bg-card shadow-sm" 
              : "border-dashed border-muted-foreground/30 bg-muted/30",
            disabled && "opacity-50 cursor-not-allowed bg-muted/20",
            isLoading && "animate-pulse"
          )}
        >
          {/* Logo Retangular no Topo */}
          <div className={cn(
            "w-full aspect-[2/1] rounded-lg flex items-center justify-center overflow-hidden mb-3 transition-colors",
            value ? bgColorClass : "bg-muted"
          )}>
            {selectedRendered?.imageUrl ? (
              <img 
                src={selectedRendered.imageUrl} 
                alt={selectedRendered.label}
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <Icon className={cn(
                "h-8 w-8 sm:h-10 sm:w-10 transition-colors",
                value ? iconColorClass : "text-muted-foreground"
              )} />
            )}
          </div>
          
          {/* Label e Texto */}
          <div className="w-full text-left space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1">
                <Icon className={cn("h-3 w-3", iconColorClass)} />
                {label}
              </span>
            </div>
            {selectedRendered ? (
              <>
                <p className="font-semibold truncate text-sm sm:text-base">{selectedRendered.label}</p>
                {selectedRendered.sublabel && (
                  <p className="text-xs text-muted-foreground truncate">{selectedRendered.sublabel}</p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">{placeholder}</p>
            )}
          </div>
        </SelectTrigger>
        
        <SelectContent className="max-h-[300px] w-[var(--radix-select-trigger-width)]">
          {items.length === 0 ? (
            <div className="py-4 px-3 text-center text-sm text-muted-foreground">
              {isLoading ? 'Carregando...' : 'Nenhum item disponível'}
            </div>
          ) : (
            items.map((item) => {
              const rendered = renderItem(item);
              return (
                <SelectItem 
                  key={rendered.id} 
                  value={rendered.id}
                  className="py-3 px-2 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {/* Logo Retangular do item */}
                    <div className={cn(
                      "h-10 w-16 sm:h-12 sm:w-20 rounded-lg flex items-center justify-center shrink-0 overflow-hidden",
                      bgColorClass
                    )}>
                      {rendered.imageUrl ? (
                        <img 
                          src={rendered.imageUrl} 
                          alt={rendered.label}
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", iconColorClass)} />
                      )}
                    </div>
                    
                    {/* Texto do item */}
                    <div className="min-w-0 flex-1">
                      <span className="font-medium truncate block text-sm">{rendered.label}</span>
                      {rendered.sublabel && (
                        <p className="text-xs text-muted-foreground truncate">{rendered.sublabel}</p>
                      )}
                    </div>
                  </div>
                </SelectItem>
              );
            })
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
