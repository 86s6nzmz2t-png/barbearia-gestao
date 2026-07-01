import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type ClientOption = { id: string; name: string };

type Props = {
  clients: ClientOption[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
};

const PINNED = [
  { value: "none", label: "— Sem cliente —" },
  { value: "avulso", label: "Avulso" },
];

export function ClientCombobox({ clients, value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);

  const selectedLabel =
    PINNED.find((p) => p.value === value)?.label ??
    clients.find((c) => c.id === value)?.name ??
    "— Sem cliente —";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal bg-transparent border-input shadow-sm hover:bg-transparent",
            className,
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-(--radix-popover-trigger-width) min-w-[220px]"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Buscar cliente..." />
          <CommandList>
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            <CommandGroup>
              {PINNED.map((p) => (
                <CommandItem
                  key={p.value}
                  value={p.label}
                  onSelect={() => { onChange(p.value); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === p.value ? "opacity-100 text-gold" : "opacity-0")} />
                  {p.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {clients.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Clientes">
                  {clients.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={c.name}
                      onSelect={() => { onChange(c.id); setOpen(false); }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100 text-gold" : "opacity-0")} />
                      {c.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
