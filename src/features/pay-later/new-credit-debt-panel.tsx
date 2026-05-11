"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Handshake, Minus, Plus } from "lucide-react";
import type { InstaQLEntity } from "@instantdb/react";
import type { AppSchema } from "@/instant.schema";
import { db } from "@/lib/db";
import {
  appendSyncHint,
  createCreditDebtClient,
} from "@/lib/client-db-write";
import {
  BarcodeInput,
  normalizeScanInput,
} from "@/components/barcode-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { isLowStock } from "@/lib/constants";
import { formatMoney } from "@/lib/format-money";

type Product = InstaQLEntity<AppSchema, "products">;

export function NewCreditDebtPanel({ products }: { products: Product[] }) {
  const [product, setProduct] = React.useState<Product | null>(null);
  const [quantity, setQuantity] = React.useState(1);
  const [customerName, setCustomerName] = React.useState("");
  const [totalOwedStr, setTotalOwedStr] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [totalManual, setTotalManual] = React.useState(false);
  const { user } = db.useAuth();

  const mut = useMutation({
    mutationFn: (payload: {
      customerName: string;
      productId: string;
      quantity: number;
      totalOwed: number;
      notes?: string;
    }) => {
      const p = products.find((x) => x.id === payload.productId);
      if (!p) {
        return Promise.resolve({
          ok: false as const,
          error: "Product not found",
        });
      }
      return createCreditDebtClient(user?.id, payload, p);
    },
    onSuccess: (res) => {
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(
          appendSyncHint(
            "Pay-later sale saved · stock updated",
            res.syncStatus,
          ),
        );
        setProduct(null);
        setQuantity(1);
        setCustomerName("");
        setTotalOwedStr("");
        setNotes("");
        setTotalManual(false);
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

  const defaultTotal =
    product != null ? product.sellingPrice * quantity : null;

  React.useEffect(() => {
    if (!product) {
      setTotalOwedStr("");
      return;
    }
    if (!totalManual && defaultTotal != null) {
      setTotalOwedStr(defaultTotal.toFixed(2));
    }
  }, [product, defaultTotal, totalManual]);

  function pickProduct(p: Product) {
    setProduct(p);
    setTotalManual(false);
    toast.message(`Product · ${p.name}`, { duration: 1200 });
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
      pickProduct(direct);
      return;
    }

    const term = code.toLowerCase();
    const match = products.find(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.barcode?.toLowerCase().includes(term) ?? false),
    );
    if (match) pickProduct(match);
    else toast.error("No product matches this barcode");
  }

  function submit() {
    const name = customerName.trim();
    if (!name) {
      toast.error("Customer name is required");
      return;
    }
    if (!product) {
      toast.error("Choose a product (scan barcode)");
      return;
    }
    if (quantity < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }
    if (product.stockQuantity < quantity) {
      toast.error(`Insufficient stock for "${product.name}"`);
      return;
    }

    const owed = Number.parseFloat(totalOwedStr);
    if (!Number.isFinite(owed) || owed <= 0) {
      toast.error("Enter how much the customer owes");
      return;
    }

    mut.mutate({
      customerName: name,
      productId: product.id,
      quantity,
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

        <BarcodeInput
          onScan={handleScan}
          label="Scan product"
          placeholder="Scan one product — replaces selection"
        />
        <Separator />

        {product ? (
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <div className="font-medium">{product.name}</div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                List price {formatMoney(product.sellingPrice)} · stock{" "}
                {product.stockQuantity}
              </span>
              {isLowStock(product.stockQuantity) ? (
                <Badge variant="warning" className="text-[10px] uppercase">
                  Low stock
                </Badge>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Quantity</span>
              <Button
                type="button"
                size="lg"
                variant="outline"
                aria-label="Decrease quantity"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus className="size-5" />
              </Button>
              <Input
                className="w-16 text-center font-mono text-lg"
                inputMode="numeric"
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.max(1, Number.parseInt(e.target.value, 10) || 1))
                }
              />
              <Button
                type="button"
                size="lg"
                variant="outline"
                aria-label="Increase quantity"
                onClick={() => setQuantity((q) => q + 1)}
              >
                <Plus className="size-5" />
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="credit-total">Amount owed</Label>
              <Input
                id="credit-total"
                className="max-w-xs tabular-nums"
                inputMode="decimal"
                value={totalOwedStr}
                onChange={(e) => {
                  setTotalManual(true);
                  setTotalOwedStr(e.target.value);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Defaults to quantity × price; edit if you agreed a different
                balance.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Scan a product — stock leaves when you save this IOU.
          </p>
        )}

        <div className="flex justify-end border-t border-border pt-4">
          <Button
            type="button"
            size="lg"
            className="min-h-12 px-10 text-base"
            disabled={mut.isPending || !product}
            onClick={() => submit()}
          >
            {mut.isPending ? "Saving…" : "Save pay-later sale"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
