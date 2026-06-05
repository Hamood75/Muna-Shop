"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Handshake, Minus, Plus } from "lucide-react";
import type { Product } from "@/lib/entities";
import { useShopSession } from "@/context/shop-session";
import {
  appendSyncHint,
  createCreditDebtClient,
} from "@/lib/write";
import { queryKeys } from "@/lib/query-keys";
import { ProductScanCombo } from "@/components/product-scan-combo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { isLowStock } from "@/lib/constants";
import { formatMoney } from "@/lib/format-money";
import {
  bumpSaleQuantity,
  isPositiveSaleQuantity,
} from "@/lib/quantity";
import { SaleQuantityInput } from "@/components/sale-quantity-input";

type Line = { product: Product; quantity: number };

export function NewCreditDebtPanel({ products }: { products: Product[] }) {
  const [lines, setLines] = React.useState<Line[]>([]);
  const [customerName, setCustomerName] = React.useState("");
  const [totalOwedStr, setTotalOwedStr] = React.useState("");
  const [totalManual, setTotalManual] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const { profile } = useShopSession();
  const queryClient = useQueryClient();

  const mut = useMutation({
    mutationFn: (payload: {
      customerName: string;
      items: { productId: string; quantity: number }[];
      totalOwed: number;
      notes?: string;
    }) => createCreditDebtClient(profile?.id, payload, products),
    onSuccess: (res) => {
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(
          appendSyncHint("Pay-later sale saved · stock updated"),
        );
        setLines([]);
        setCustomerName("");
        setTotalOwedStr("");
        setTotalManual(false);
        setNotes("");
        void queryClient.invalidateQueries({ queryKey: queryKeys.root });
      }
    },
  });

  function addProduct(product: Product, qty: number) {
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

  const catalogTotal = lines.reduce(
    (sum, l) => sum + l.product.sellingPrice * l.quantity,
    0,
  );

  React.useEffect(() => {
    if (!lines.length) {
      setTotalOwedStr("");
      return;
    }
    if (!totalManual) {
      setTotalOwedStr(catalogTotal.toFixed(2));
    }
  }, [lines, catalogTotal, totalManual]);

  function submit() {
    const name = customerName.trim();
    if (!name) {
      toast.error("Customer name is required");
      return;
    }
    if (!lines.length) {
      toast.error("Add at least one product");
      return;
    }

    const owed = Number.parseFloat(totalOwedStr);
    if (!Number.isFinite(owed) || owed <= 0) {
      toast.error("Enter how much the customer owes");
      return;
    }

    mut.mutate({
      customerName: name,
      items: lines.map((l) => ({
        productId: l.product.id,
        quantity: l.quantity,
      })),
      totalOwed: owed,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Handshake className="size-5" aria-hidden />
          Pay later (customer owes)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="credit-customer">Customer name</Label>
            <Input
              id="credit-customer"
              placeholder="Who is taking the stock?"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="credit-notes">Notes (optional)</Label>
            <Input
              id="credit-notes"
              placeholder="Phone, reference…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4">
          <ProductScanCombo
            products={products}
            onPick={(p) => addProduct(p, 1)}
            autoFocus={false}
            id="credit-scan"
            label="Products"
            placeholder="Scan or search to add products — pick several items for one customer"
          />
          <Separator />

          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add one or more products — stock leaves when you save this IOU.
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
                  </div>
                  <div className="w-full text-right text-base font-semibold tabular-nums sm:w-auto">
                    {formatMoney(line.product.sellingPrice * line.quantity)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid max-w-xl gap-4">
          <div className="space-y-2">
            <Label htmlFor="credit-total">Amount owed</Label>
            <Input
              id="credit-total"
              className="max-w-xs tabular-nums"
              inputMode="decimal"
              value={totalOwedStr}
              disabled={!lines.length}
              onChange={(e) => {
                setTotalManual(true);
                setTotalOwedStr(e.target.value);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Defaults to the sum of all lines; edit if you agreed a different
              balance.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-lg font-semibold tabular-nums">
            Catalog total · {formatMoney(catalogTotal)}
          </div>
          <Button
            type="button"
            size="lg"
            className="min-h-12 px-10 text-base"
            disabled={mut.isPending || !lines.length}
            onClick={() => submit()}
          >
            {mut.isPending ? "Saving…" : "Save pay-later sale"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
