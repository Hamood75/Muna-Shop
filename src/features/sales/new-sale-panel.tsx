"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { isLowStock } from "@/lib/constants";
import { formatMoney } from "@/lib/format-money";
import { bumpSaleQuantity, isPositiveSaleQuantity } from "@/lib/quantity";
import { SaleQuantityInput } from "@/components/sale-quantity-input";

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

  function setQty(productId: string, quantity: number) {
    if (!isPositiveSaleQuantity(quantity)) {
      setLines((prev) => prev.filter((l) => l.product.id !== productId));
      return;
    }
    setLines((prev) =>
      prev.map((l) =>
        l.product.id === productId ? { ...l, quantity } : l,
      ),
    );
  }

  function removeLine(productId: string) {
    setLines((prev) => prev.filter((l) => l.product.id !== productId));
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
        <ProductScanCombo
          products={products}
          onPick={(p) => addProduct(p, 1)}
          autoFocus
          id="sale-scan"
          label="Scan or search by name"
          placeholder="Scan barcode to add — or type product name and pick from the list"
        />
        <Separator />

        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Cart is empty — scan or search above to begin.
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
                      setQty(
                        line.product.id,
                        bumpSaleQuantity(line.quantity, -1),
                      )
                    }
                  >
                    <Minus className="size-5" />
                  </Button>
                  <SaleQuantityInput
                    value={line.quantity}
                    onChange={(q) => setQty(line.product.id, q)}
                  />
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    aria-label="Increase quantity"
                    onClick={() =>
                      setQty(
                        line.product.id,
                        bumpSaleQuantity(line.quantity, 1),
                      )
                    }
                  >
                    <Plus className="size-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive [&_svg]:size-5"
                    aria-label="Remove line"
                    onClick={() => removeLine(line.product.id)}
                  >
                    <Trash2 className="size-5" />
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
