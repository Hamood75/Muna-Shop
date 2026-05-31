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

/** Barcode-only auto-pick (scanner / typed barcode). Name search never auto-selects. */
export function resolvePickFromScan(
  _products: Product[],
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
  return direct;
}

/** Search full catalogue: every word in the query must match name or barcode. */
export function filterProductsByNameOrBarcode(
  products: Product[],
  raw: string,
  limit = 80,
): Product[] {
  const q = normalizeScanInput(raw).toLowerCase();
  if (!q) return [];

  const tokens = q.split(/\s+/).filter(Boolean);

  const out = products.filter((p) => {
    const hay = `${p.name.toLowerCase()} ${p.barcode?.toLowerCase() ?? ""}`;
    return tokens.every((tok) => hay.includes(tok));
  });
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out.slice(0, limit);
}
