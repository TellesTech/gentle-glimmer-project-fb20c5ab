import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { JOB_FUNCTIONS } from '@/lib/jobFunctions';

interface FunctionSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function FunctionSelect({ value, onChange, placeholder = 'Selecione a função' }: FunctionSelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar função..." />
          <CommandList>
            <CommandEmpty>Nenhuma função encontrada.</CommandEmpty>
            <CommandGroup>
              {JOB_FUNCTIONS.map((fn) => (
                <CommandItem
                  key={fn}
                  value={fn}
                  onSelect={() => {
                    onChange(fn);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value?.toUpperCase() === fn ? 'opacity-100' : 'opacity-0')} />
                  {fn}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
