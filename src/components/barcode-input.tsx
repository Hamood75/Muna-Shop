"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function normalizeScanInput(raw: string): string {
  return raw.replace(/[\x00-\x1F]/g, "").trim();
}

type Props = {
  id?: string;
  label?: string;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  /** Minimum characters before auto-submit after a fast wedge burst (default 4). */
  minScanLength?: number;
  /** Ms after last key before treating a fast burst as complete (default 55). */
  wedgeIdleMs?: number;
  /** Max ms from first to last key in a burst to count as scanner-like (default 280). */
  wedgeBurstMaxMs?: number;
  onScan: (code: string) => void;
};

/**
 * Keyboard-wedge scanners emit characters in quick succession, usually ending with Enter.
 * Some devices omit Enter; we detect a "burst" (rapid typing) and submit after a short idle.
 */
export function BarcodeInput({
  id = "barcode-scan",
  label = "Scan barcode",
  disabled,
  placeholder = "Scan barcode — auto-adds when complete — or type and press Enter",
  autoFocus,
  className,
  minScanLength = 4,
  wedgeIdleMs = 55,
  wedgeBurstMaxMs = 280,
  onScan,
}: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const idleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstFirstRef = React.useRef<number>(0);
  const burstLastRef = React.useRef<number>(0);

  React.useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  function clearIdleTimer() {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }

  function scheduleWedgeIdleSubmit() {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      const el = inputRef.current;
      if (!el || disabled) return;
      const value = el.value;
      const code = normalizeScanInput(value);
      if (code.length < minScanLength) return;

      const span =
        burstLastRef.current > 0 && burstFirstRef.current > 0
          ? burstLastRef.current - burstFirstRef.current
          : Infinity;

      if (span <= wedgeBurstMaxMs) {
        onScan(code);
        el.value = "";
        burstFirstRef.current = 0;
        burstLastRef.current = 0;
        queueMicrotask(() => inputRef.current?.focus());
      }
    }, wedgeIdleMs);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      clearIdleTimer();
      burstFirstRef.current = 0;
      burstLastRef.current = 0;
      const code = normalizeScanInput(e.currentTarget.value);
      if (code) {
        onScan(code);
        e.currentTarget.value = "";
        queueMicrotask(() => inputRef.current?.focus());
      }
      return;
    }

    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;

    const now = Date.now();
    const gapSincePrev =
      burstLastRef.current > 0 ? now - burstLastRef.current : Infinity;

    if (!burstFirstRef.current || gapSincePrev > 100) {
      burstFirstRef.current = now;
    }
    burstLastRef.current = now;
    scheduleWedgeIdleSubmit();
  }

  function handleBlur() {
    clearIdleTimer();
    burstFirstRef.current = 0;
    burstLastRef.current = 0;
  }

  return (
    <div className={className}>
      {label ? (
        <Label htmlFor={id} className="mb-2 block">
          {label}
        </Label>
      ) : null}
      <Input
        ref={inputRef}
        id={id}
        name={id}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        placeholder={placeholder}
        autoFocus={autoFocus}
        inputMode="text"
        className="font-mono text-lg tracking-wide"
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    </div>
  );
}
