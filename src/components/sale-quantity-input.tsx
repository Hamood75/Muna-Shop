"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  formatQuantityDisplay,
  isIncompleteQuantityInput,
  isPositiveSaleQuantity,
  normalizeQuantityTyping,
  parseSaleQuantity,
} from "@/lib/quantity";

type SaleQuantityInputProps = {
  value: number;
  onChange: (quantity: number) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
};

/**
 * Quantity field that keeps "." visible while typing (0.5, 0.75, …).
 */
export function SaleQuantityInput({
  value,
  onChange,
  disabled,
  className = "w-20 text-center font-mono text-lg",
  id,
}: SaleQuantityInputProps) {
  const [draft, setDraft] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDraft(null);
  }, [value]);

  const display =
    draft !== null
      ? draft
      : value > 0
        ? formatQuantityDisplay(value)
        : "";

  function commitFromDraft(raw: string) {
    const normalized = normalizeQuantityTyping(raw);
    setDraft(null);
    if (!normalized || normalized === ".") {
      onChange(0);
      return;
    }
    onChange(parseSaleQuantity(normalized));
  }

  return (
    <Input
      id={id}
      className={className}
      inputMode="decimal"
      placeholder="0.5"
      disabled={disabled}
      value={display}
      onChange={(e) => {
        const normalized = normalizeQuantityTyping(e.target.value);
        setDraft(normalized);
        if (!isIncompleteQuantityInput(normalized)) {
          onChange(parseSaleQuantity(normalized));
        }
      }}
      onBlur={() => {
        if (draft !== null) {
          commitFromDraft(draft);
        } else if (!isPositiveSaleQuantity(value)) {
          onChange(0);
        }
      }}
    />
  );
}
