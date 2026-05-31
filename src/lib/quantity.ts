/** Smallest allowed sale quantity (supports 0.5, 0.75, etc.). */
export const MIN_SALE_QUANTITY = 0.001;

export const SALE_QUANTITY_STEP = 0.25;

export function parseSaleQuantity(raw: string): number {
  const cleaned = raw.trim().replace(",", ".");
  if (!cleaned) return 0;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1000) / 1000;
}

export function isPositiveSaleQuantity(n: number): boolean {
  return Number.isFinite(n) && n >= MIN_SALE_QUANTITY;
}

export function bumpSaleQuantity(current: number, direction: -1 | 1): number {
  const step =
    current < 1 && direction === -1
      ? SALE_QUANTITY_STEP
      : current < 1 && direction === 1
        ? SALE_QUANTITY_STEP
        : current >= 1 && direction === -1 && current - 1 < 1
          ? SALE_QUANTITY_STEP
          : 1;
  const next = Math.round((current + direction * step) * 1000) / 1000;
  return next;
}

/** Display without trailing zeros (e.g. 0.5, 1.25). */
export function formatQuantityDisplay(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const r = Math.round(n * 1000) / 1000;
  if (Number.isInteger(r)) return String(r);
  return r.toFixed(3).replace(/\.?0+$/, "");
}
