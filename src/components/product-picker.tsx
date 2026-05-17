"use client";

import * as React from "react";
import { ChevronsUpDown } from "lucide-react";
import type { Product } from "@/lib/entities";
import { cn } from "@/lib/utils";
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

export type ProductPickerProps = {
  products: Product[];
  value: string;
  onValueChange: (productId: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  id?: string;
  /** Second line under product name (e.g. stock level). */
  getSubtitle?: (product: Product) => React.ReactNode;
  allowClear?: boolean;
  clearLabel?: string;
  className?: string;
};

export function ProductPicker({
  products,
  value,
  onValueChange,
  placeholder = "Select product…",
  searchPlaceholder = "Search name or barcode…",
  emptyText = "No product found.",
  disabled,
  id,
  getSubtitle,
  allowClear,
  clearLabel = "Clear selection",
  className,
}: ProductPickerProps) {
  const [open, setOpen] = React.useState(false);

  const sorted = React.useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name)),
    [products],
  );

  const selected = React.useMemo(
    () => sorted.find((p) => p.id === value),
    [sorted, value],
  );

  const triggerLabel = selected?.name ?? placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || products.length === 0}
          className={cn(
            "h-11 w-full justify-between gap-2 px-3 font-normal overflow-hidden",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate text-left">{triggerLabel}</span>
          <ChevronsUpDown
            className="size-4 shrink-0 opacity-50"
            aria-hidden
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="min-w-[280px] max-w-[min(100vw-2rem,480px)] border-border p-0 shadow-xl"
        align="start"
      >
        <Command shouldFilter>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup heading="Products">
              {allowClear && value ? (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onValueChange("");
                    setOpen(false);
                  }}
                  className="text-muted-foreground"
                >
                  {clearLabel}
                </CommandItem>
              ) : null}
              {sorted.map((p) => {
                const subtitle = getSubtitle?.(p);
                const subtitlePlain =
                  typeof subtitle === "string" || typeof subtitle === "number"
                    ? String(subtitle)
                    : "";
                const searchBlob = [p.name, p.barcode ?? "", p.id, subtitlePlain]
                  .join(" ")
                  .trim();
                return (
                  <CommandItem
                    key={p.id}
                    value={searchBlob}
                    onSelect={() => {
                      onValueChange(p.id);
                      setOpen(false);
                    }}
                  >
                    <span className="font-medium leading-tight">{p.name}</span>
                    {subtitle ? (
                      <span className="text-xs text-muted-foreground">
                        {subtitle}
                      </span>
                    ) : p.barcode ? (
                      <span className="text-xs text-muted-foreground font-mono">
                        {p.barcode}
                      </span>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
