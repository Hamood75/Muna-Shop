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
import { ProductScanCombo } from "@/components/product-scan-combo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { isLowStock } from "@/lib/constants";
import { formatMoney } from "@/lib/format-money";

type Line = { productId: string; quantity: number };

export function NewSalePanel({ products }: { products: Product[] }) {
  const [lines, setLines] = React.useState<Line[]>([]);
  const { profile } = useShopSession();
  const queryClient = useQueryClient();

  const byId = React.useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  React.useEffect(() => {
    const ids = new Set(products.map((p) => p.id));
    setLines((prev) => prev.filter((l) => ids.has(l.productId)));
  }, [products]);

  const saleMut = useMutation({
    mutationFn: (payload: { items: { productId: string; quantity: number }[] }) =>
      recordSaleClient(profile?.id, payload, products),
    onSuccess: (res) => {
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(appendSyncHint("Sale saved · stock updated"));
        void queryClient.invalidateQueries({ queryKey: queryKeys.root });
      }
    },
  });

  function addProduct(product: Product, qty = 1) {
    const id = product.id;
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === id);
      if (idx === -1) return [...prev, { productId: id, quantity: qty }];
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        quantity: next[idx].quantity + qty,
      };
      return next;
    });
    toast.message(`Added ${product.name}`, { duration: 1200 });
  }

  function setQty(productId: string, quantity: number) {
    if (quantity < 1) {
      setLines((prev) => prev.filter((l) => l.productId !== productId));
      return;
    }
    setLines((prev) =>
      prev.map((l) =>
        l.productId === productId ? { ...l, quantity } : l,
      ),
    );
  }

  const subtotal = lines.reduce((sum, l) => {
    const p = byId.get(l.productId);
    return p ? sum + p.sellingPrice * l.quantity : sum;
  }, 0);

  const activeLines = lines.filter((l) => byId.has(l.productId));

  function submit() {
    const items = activeLines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
    }));
    if (!items.length) {
      toast.error("Add at least one line");
      return;
    }
    saleMut.mutate({ items });
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
        <ProductScanCombo
          products={products}
          onPick={(p) => addProduct(p, 1)}
          autoFocus
          id="sale-scan"
          label="Scan or search by name"
          placeholder="Barcode scanner — type part of name — dropdown appears — pick row or Enter if one match"
        />
        <Separator />

        {activeLines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Cart is empty — scan or search above to begin.
          </p>
        ) : (
          <ul className="space-y-4">
            {activeLines.map((line) => {
              const p = byId.get(line.productId)!;
              return (
              <li
                key={line.productId}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 p-3"
              >
                  <div className="min-w-[140px] flex-1">
                    <div className="font-medium">{p.name}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {formatMoney(p.sellingPrice)} each · stock{" "}
                        {p.stockQuantity}
                      </span>
                      {isLowStock(p.stockQuantity) ? (
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
                      setQty(line.productId, line.quantity - 1)
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
                        line.productId,
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
                      setQty(line.productId, line.quantity + 1)
                    }
                  >
                    <Plus className="size-5" />
                  </Button>
                </div>
                <div className="w-full text-right text-base font-semibold tabular-nums sm:w-auto">
                  {formatMoney(p.sellingPrice * line.quantity)}
                </div>
              </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="text-lg font-semibold tabular-nums">
              Total · {formatMoney(subtotal)}
            </div>
            <p className="max-w-xl text-xs text-muted-foreground">
              The cart stays after saving so you can change quantities or add
              lines and record another sale.
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            className="min-h-12 px-10 text-base"
            disabled={saleMut.isPending || !activeLines.length}
            onClick={() => submit()}
          >
            {saleMut.isPending ? "Saving…" : "Save sale"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
