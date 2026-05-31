"use client";

import * as React from "react";
import { toast } from "sonner";
import type { Product } from "@/lib/entities";
import { cn } from "@/lib/utils";
import {
  BarcodeInput,
  normalizeScanInput,
} from "@/components/barcode-input";
import {
  buildBarcodeLookup,
  filterProductsByNameOrBarcode,
  resolvePickFromScan,
} from "@/lib/product-lookup";
import { formatMoney } from "@/lib/format-money";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

export type ProductScanComboProps = Omit<
  React.ComponentProps<typeof BarcodeInput>,
  "onScan" | "onTypingChange"
> & {
  products: Product[];
  /** Add / select one item from barcode or picker. */
  onPick: (product: Product) => void;
  /** Wait this long after typing before showing dropdown (scanner bursts stay snappy). */
  suggestDebounceMs?: number;
  /** Minimum trimmed length before showing suggestion list. */
  minSuggestChars?: number;
  className?: string;
};

/**
 * Barcode scan auto-adds; typed name search always shows a dropdown — user must pick a row.
 */
export function ProductScanCombo({
  products,
  onPick,
  suggestDebounceMs = 120,
  minSuggestChars = 1,
  className,
  ...barcodeProps
}: ProductScanComboProps) {
  const barcodeMap = React.useMemo(
    () => buildBarcodeLookup(products),
    [products],
  );

  const [draft, setDraft] = React.useState("");
  const [resetKey, setResetKey] = React.useState(0);
  const debouncedDraft = useDebouncedValue(draft, suggestDebounceMs);

  const matchesDebounced = React.useMemo(
    () => filterProductsByNameOrBarcode(products, debouncedDraft),
    [products, debouncedDraft],
  );

  const matchesLive = React.useMemo(
    () => filterProductsByNameOrBarcode(products, draft),
    [products, draft],
  );

  const matches = draft === debouncedDraft ? matchesDebounced : matchesLive;
  const trimmedLive = normalizeScanInput(draft);

  const showDropdown =
    trimmedLive.length >= minSuggestChars && matches.length > 0;

  function pickAndReset(product: Product) {
    onPick(product);
    setDraft("");
    setResetKey((k) => k + 1);
  }

  function handleScan(rawCode: string) {
    const resolved = resolvePickFromScan(products, barcodeMap, rawCode);
    if (resolved) {
      pickAndReset(resolved);
      return;
    }
    const term = normalizeScanInput(rawCode);
    if (!term) return;
    setDraft(term);
    const options = filterProductsByNameOrBarcode(products, term);
    if (options.length === 0) {
      toast.error("No product matches — try another name or scan the barcode");
      return;
    }
    toast.message("Choose a product from the list below", { duration: 2400 });
  }

  return (
    <div className={cn("relative", className)}>
      <BarcodeInput
        key={resetKey}
        {...barcodeProps}
        wedgeAutoSubmit={false}
        onTypingChange={setDraft}
        onScan={handleScan}
      />

      {showDropdown ? (
        <ul
          className={cn(
            "absolute left-0 right-0 top-full z-[100] mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-card shadow-lg",
          )}
          role="listbox"
          aria-label="Matching products"
        >
          {matches.map((p) => (
            <li key={p.id} role="option" className="border-b border-border/60 last:border-0">
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm hover:bg-muted/70 focus-visible:bg-muted focus-visible:outline-none"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickAndReset(p)}
              >
                <span className="font-medium leading-tight">{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatMoney(p.sellingPrice)}
                  {p.barcode ? (
                    <>
                      {" "}
                      · <span className="font-mono">{p.barcode}</span>
                    </>
                  ) : null}
                  {" · stock "}
                  {p.stockQuantity}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
