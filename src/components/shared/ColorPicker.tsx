import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  className?: string;
}

export function ColorPicker({ label, value, onChange, description, className }: ColorPickerProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-3">
        <div className="relative">
          <Input
            type="color"
            value={value || '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="h-12 w-12 p-1 cursor-pointer border-2 rounded-lg"
          />
        </div>
        <div className="flex-1">
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className="font-mono uppercase"
            maxLength={7}
          />
        </div>
        <div 
          className="h-12 w-24 rounded-lg border-2 shadow-inner"
          style={{ backgroundColor: value || '#000000' }}
        />
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
