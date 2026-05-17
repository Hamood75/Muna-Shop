"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import type { Product } from "@/lib/entities";
import { useShopSession } from "@/context/shop-session";
import {
  appendSyncHint,
  recordSaleClient,
} from "@/lib/write";
import { queryKeys } from "@/lib/query-keys";
import {
  BarcodeInput,
  normalizeScanInput,
} from "@/components/barcode-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { isLowStock } from "@/lib/constants";
import { formatMoney } from "@/lib/format-money";

type Line = { product: Product; quantity: number };

export function NewSalePanel({ products }: { products: Product[] }) {
  const [lines, setLines] = React.useState<Line[]>([]);
  const { profile } = useShopSession();
  const queryClient = useQueryClient();

  const saleMut = useMutation({
    mutationFn: (payload: { items: { productId: string; quantity: number }[] }) =>
      recordSaleClient(profile?.id, payload, products),
    onSuccess: (res) => {
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(appendSyncHint("Sale saved · stock updated"));
        setLines([]);
        void queryClient.invalidateQueries({ queryKey: queryKeys.root });
      }
    },
  });

  const byBarcode = React.useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) {
      const raw = p.barcode?.trim();
      if (!raw) continue;
      m.set(raw, p);
      m.set(raw.toLowerCase(), p);
    }
    return m;
  }, [products]);

  function addProduct(product: Product, qty = 1) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.product.id === product.id);
      if (idx === -1) return [...prev, { product, quantity: qty }];
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        quantity: next[idx].quantity + qty,
      };
      return next;
    });
    toast.message(`Added ${product.name}`, { duration: 1200 });
  }

  function handleScan(rawCode: string) {
    const code = normalizeScanInput(rawCode);
    if (!code) return;

    let direct = byBarcode.get(code) ?? byBarcode.get(code.toLowerCase());
    if (!direct && /^\d+$/.test(code)) {
      const stripped = code.replace(/^0+/, "") || "0";
      direct =
        byBarcode.get(stripped) ??
        byBarcode.get(stripped.toLowerCase()) ??
        byBarcode.get(code.padStart(13, "0")) ??
        byBarcode.get(code.padStart(12, "0"));
    }
    if (direct) {
      addProduct(direct, 1);
      return;
    }

    const term = code.toLowerCase();
    const match = products.find(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.barcode?.toLowerCase().includes(term) ?? false),
    );
    if (match) addProduct(match, 1);
    else toast.error("No product matches this barcode");
  }

  function setQty(productId: string, quantity: number) {
    if (quantity < 1) {
      setLines((prev) => prev.filter((l) => l.product.id !== productId));
      return;
    }
    setLines((prev) =>
      prev.map((l) =>
        l.product.id === productId ? { ...l, quantity } : l,
      ),
    );
  }

  const subtotal = lines.reduce(
    (sum, l) => sum + l.product.sellingPrice * l.quantity,
    0,
  );

  function submit() {
    if (!lines.length) {
      toast.error("Add at least one line");
      return;
    }
    saleMut.mutate({
      items: lines.map((l) => ({
        productId: l.product.id,
        quantity: l.quantity,
      })),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShoppingBag className="size-5" aria-hidden />
          Record sale
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <BarcodeInput
          autoFocus
          onScan={handleScan}
          label="Scan or search"
          placeholder="Point scanner here — item adds automatically — or type and press Enter"
        />
        <Separator />

        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Cart is empty — scan a barcode to begin.
          </p>
        ) : (
          <ul className="space-y-4">
            {lines.map((line) => (
              <li
                key={line.product.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 p-3"
              >
                  <div className="min-w-[140px] flex-1">
                    <div className="font-medium">{line.product.name}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {formatMoney(line.product.sellingPrice)} each · stock{" "}
                        {line.product.stockQuantity}
                      </span>
                      {isLowStock(line.product.stockQuantity) ? (
                        <Badge variant="warning" className="text-[10px] uppercase">
                          Low stock
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    aria-label="Decrease quantity"
                    onClick={() =>
                      setQty(line.product.id, line.quantity - 1)
                    }
                  >
                    <Minus className="size-5" />
                  </Button>
                  <Input
                    className="w-16 text-center font-mono text-lg"
                    inputMode="numeric"
                    value={line.quantity}
                    onChange={(e) =>
                      setQty(
                        line.product.id,
                        Number.parseInt(e.target.value, 10) || 0,
                      )
                    }
                  />
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    aria-label="Increase quantity"
                    onClick={() =>
                      setQty(line.product.id, line.quantity + 1)
                    }
                  >
                    <Plus className="size-5" />
                  </Button>
                </div>
                <div className="w-full text-right text-base font-semibold tabular-nums sm:w-auto">
                  {formatMoney(line.product.sellingPrice * line.quantity)}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-lg font-semibold tabular-nums">
            Total · {formatMoney(subtotal)}
          </div>
          <Button
            type="button"
            size="lg"
            className="min-h-12 px-10 text-base"
            disabled={saleMut.isPending || !lines.length}
            onClick={() => submit()}
          >
            {saleMut.isPending ? "Saving…" : "Save sale"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
