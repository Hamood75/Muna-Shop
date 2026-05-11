"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { InstaQLEntity } from "@instantdb/react";
import type { AppSchema } from "@/instant.schema";
import {
  appendSyncHint,
  adjustStockClient,
} from "@/lib/client-db-write";
import { isLowStock, LOW_STOCK_THRESHOLD } from "@/lib/constants";
import { ProductPicker } from "@/components/product-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Product = InstaQLEntity<AppSchema, "products">;

type AdjustKind = "restock" | "adjustment" | "damaged";

export function InventoryAdjustCard({ products }: { products: Product[] }) {
  const [productId, setProductId] = React.useState(products[0]?.id ?? "");
  const [delta, setDelta] = React.useState(1);
  const [note, setNote] = React.useState("");
  const [kind, setKind] = React.useState<AdjustKind>("restock");

  React.useEffect(() => {
    if (!productId && products[0]?.id) setProductId(products[0].id);
  }, [products, productId]);

  const mut = useMutation({
    mutationFn: (payload: {
      productId: string;
      delta: number;
      note: string;
      kind: AdjustKind;
    }) => {
      const p = products.find((x) => x.id === payload.productId);
      if (!p) {
        return Promise.resolve({
          ok: false as const,
          error: "Product not found",
        });
      }
      return adjustStockClient(payload, p);
    },
    onSuccess: (res) => {
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(appendSyncHint("Stock updated", res.syncStatus));
        setNote("");
      }
    },
  });

  function resolveDelta(): number {
    if (kind === "restock") return Math.abs(delta);
    if (kind === "damaged") return -Math.abs(delta);
    return delta;
  }

  function submit() {
    if (!productId) {
      toast.error("Choose a product");
      return;
    }
    const d = resolveDelta();
    if (kind === "damaged" && d === 0) {
      toast.error("Enter how many units were damaged");
      return;
    }
    if (kind === "restock" && d === 0) {
      toast.error("Enter how many units were received");
      return;
    }
    mut.mutate({
      productId,
      delta: d,
      note,
      kind,
    });
  }

  const quantityLabel =
    kind === "restock"
      ? "Units received"
      : kind === "damaged"
        ? "Units damaged / removed"
        : "Quantity change";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Adjust stock</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:max-w-xl">
        <div className="grid gap-2 md:max-w-lg">
          <Label htmlFor="inv-product">Product</Label>
          <ProductPicker
            id="inv-product"
            products={products}
            value={productId}
            onValueChange={setProductId}
            placeholder="Search product…"
            getSubtitle={(p) => (
              <span>
                {p.stockQuantity} on hand
                {isLowStock(p.stockQuantity) ? (
                  <span className="font-medium text-amber-700 dark:text-amber-300">
                    {" "}
                    · Low (≤{LOW_STOCK_THRESHOLD})
                  </span>
                ) : null}
              </span>
            )}
          />
        </div>
        <div className="grid gap-2">
          <Label>Type</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button
              type="button"
              variant={kind === "restock" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setKind("restock")}
            >
              Restock (+)
            </Button>
            <Button
              type="button"
              variant={kind === "damaged" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setKind("damaged")}
            >
              Damaged (−)
            </Button>
            <Button
              type="button"
              variant={kind === "adjustment" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setKind("adjustment")}
            >
              Adjustment (+/−)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {kind === "damaged"
              ? "Removes units from on-hand stock (breakage, spoilage, shrink)."
              : kind === "restock"
                ? "Adds inventory from suppliers or transfers in."
                : "Enter a positive or negative number for corrections."}
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="inv-delta">{quantityLabel}</Label>
          <Input
            id="inv-delta"
            type="number"
            min={kind === "adjustment" ? undefined : 1}
            value={delta}
            onChange={(e) => setDelta(Number.parseInt(e.target.value, 10) || 0)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="inv-note">Note (optional)</Label>
          <Input
            id="inv-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              kind === "damaged"
                ? "e.g. Glass cracked in transit"
                : "Supplier batch #, cycle count…"
            }
          />
        </div>
        <Button type="button" size="lg" disabled={mut.isPending} onClick={submit}>
          {mut.isPending ? "Applying…" : "Apply movement"}
        </Button>
      </CardContent>
    </Card>
  );
}
