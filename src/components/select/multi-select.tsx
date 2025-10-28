// components/common/MultiSelectShadcn.tsx
import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string; hint?: string };

type Props = {
  value: string[];
  onChange: (val: string[]) => void;
  options: Option[];
  placeholder?: string;
  emptyText?: string;
  className?: string;
  maxBadges?: number;
  disabled?: boolean;
};

export function MultiSelect({
  value,
  onChange,
  options,
  placeholder = "Selecciona…",
  emptyText = "Sin resultados",
  className,
  maxBadges = 4,
  disabled,
}: Props) {
  const [open, setOpen] = React.useState(false);

  const map = React.useMemo(
    () => new Map(options.map((o) => [o.value, o])),
    [options],
  );
  const selected = value.map((v) => map.get(v)).filter(Boolean) as Option[];

  const toggle = (val: string) => {
    if (value.includes(val)) onChange(value.filter((v) => v !== val));
    else onChange([...value, val]);
  };

  const clearOne = (val: string) => onChange(value.filter((v) => v !== val));
  const clearAll = () => onChange([]);

  return (
    <div className={cn("w-full", className)}>
      {/* Chips seleccionados */}
      <div className="mb-2 flex flex-wrap gap-2">
        {selected.slice(0, maxBadges).map((opt) => (
          <Badge
            key={opt.value}
            variant="secondary"
            className="flex items-center gap-1"
          >
            {opt.label}
            <X
              className="h-3 w-3 cursor-pointer"
              onClick={() => clearOne(opt.value)}
            />
          </Badge>
        ))}
        {selected.length > maxBadges && (
          <Badge variant="outline">+{selected.length - maxBadges}</Badge>
        )}
        {selected.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={clearAll}
          >
            Limpiar
          </Button>
        )}
      </div>

      {/* Trigger + Popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between"
          >
            {selected.length === 0
              ? placeholder
              : `${selected.length} seleccionado(s)`}
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput placeholder="Buscar paciente..." />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {options.map((opt) => {
                  const checked = value.includes(opt.value);
                  return (
                    <CommandItem
                      key={opt.value}
                      value={opt.label}
                      keywords={[opt.hint || ""]}
                      onSelect={() => toggle(opt.value)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{opt.label}</span>
                        {opt.hint && (
                          <span className="truncate text-xs text-muted-foreground">
                            {opt.hint}
                          </span>
                        )}
                      </div>
                      <Check
                        className={cn(
                          "ml-2 h-4 w-4",
                          checked ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
