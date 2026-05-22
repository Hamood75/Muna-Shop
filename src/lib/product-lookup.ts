import type { Product } from "@/lib/entities";
import { normalizeScanInput } from "@/components/barcode-input";

export function buildBarcodeLookup(products: Product[]) {
  const m = new Map<string, Product>();
  for (const p of products) {
    const raw = p.barcode?.trim();
    if (!raw) continue;
    m.set(raw, p);
    m.set(raw.toLowerCase(), p);
  }
  return m;
}

/** Barcode-aware resolution; substring name/barcode only if exactly one match. */
export function resolvePickFromScan(
  products: Product[],
  barcodeMap: Map<string, Product>,
  raw: string,
): Product | undefined {
  const code = normalizeScanInput(raw);
  if (!code) return undefined;

  let direct = barcodeMap.get(code) ?? barcodeMap.get(code.toLowerCase());
  if (!direct && /^\d+$/.test(code)) {
    const stripped = code.replace(/^0+/, "") || "0";
    direct =
      barcodeMap.get(stripped) ??
      barcodeMap.get(stripped.toLowerCase()) ??
      barcodeMap.get(code.padStart(13, "0")) ??
      barcodeMap.get(code.padStart(12, "0"));
  }
  if (direct) return direct;

  const term = code.toLowerCase();
  const found = products.filter(
    (p) =>
      p.name.toLowerCase().includes(term) ||
      (p.barcode?.toLowerCase().includes(term) ?? false),
  );
  if (found.length === 1) return found[0];
  return undefined;
}

export function filterProductsByNameOrBarcode(
  products: Product[],
  raw: string,
  limit = 50,
): Product[] {
  const q = normalizeScanInput(raw).toLowerCase();
  if (!q) return [];

  const out = products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode?.toLowerCase().includes(q) ?? false),
  );
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out.slice(0, limit);
}
