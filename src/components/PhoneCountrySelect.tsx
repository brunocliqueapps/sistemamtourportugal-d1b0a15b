import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { PHONE_OPTIONS } from "@/lib/phone-countries";
import { cn } from "@/lib/utils";

export function PhoneCountrySelect({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = value || "+351";
  const item = PHONE_OPTIONS.find((p) => p.code === current);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="justify-between font-normal px-2">
          <span className="truncate">{item ? item.label.split(" ").slice(0, 1).join(" ") + " " + current : current}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[min(20rem,calc(100vw-2rem))]" align="start">
        <Command
          filter={(val, search) => {
            const opt = PHONE_OPTIONS.find((p) => `${p.code}|${p.search}` === val);
            return opt && opt.search.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Procurar país ou indicativo..." />
          <CommandList className="max-h-64">
            <CommandEmpty>Sem resultados</CommandEmpty>
            <CommandGroup>
              {PHONE_OPTIONS.map((p) => (
                <CommandItem
                  key={p.code}
                  value={`${p.code}|${p.search}`}
                  onSelect={() => { onChange(p.code); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", current === p.code ? "opacity-100" : "opacity-0")} />
                  {p.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
