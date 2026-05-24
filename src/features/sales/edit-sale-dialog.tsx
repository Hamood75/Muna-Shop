"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { Product, Sale, SaleItem } from "@/lib/entities";
import { useShopSession } from "@/context/shop-session";
import {
  appendSyncHint,
  updateSaleClient,
  voidSaleClient,
} from "@/lib/write";
import { queryKeys } from "@/lib/query-keys";
import { ProductScanCombo } from "@/components/product-scan-combo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { isLowStock } from "@/lib/constants";
import { formatMoney } from "@/lib/format-money";

type Line = { product: Product; quantity: number };

function productForLineItem(it: SaleItem, catalog: Product[]): Product | null {
  const pid = it.productId ?? it.product?.id;
  if (!pid) return null;
  const alive = catalog.find((p) => p.id === pid);
  if (alive) return alive;
  return {
    id: pid,
    name: "Product no longer found — scan to replace line",
    barcode: null,
    buyingPrice: 0,
    sellingPrice: it.unitPrice,
    stockQuantity: 0,
    imageUrl: null,
    createdAt: 0,
  };
}

/** Merge duplicated SKUs into one cart-style line each. */
function linesFromSale(sale: Sale, catalog: Product[]): Line[] {
  const grouped = new Map<string, Line>();
  for (const it of sale.items ?? []) {
    const p = productForLineItem(it, catalog);
    if (!p) continue;
    const prev = grouped.get(p.id);
    if (!prev) {
      grouped.set(p.id, { product: p, quantity: it.quantity });
    } else {
      grouped.set(p.id, {
        product: p,
        quantity: prev.quantity + it.quantity,
      });
    }
  }
  return [...grouped.values()];
}

function invalidateShopData(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.root });
}

type EditSaleDialogProps = {
  sale: Sale | null;
  products: Product[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditSaleDialog({
  sale,
  products,
  open,
  onOpenChange,
}: EditSaleDialogProps) {
  const { profile } = useShopSession();
  const queryClient = useQueryClient();
  const [lines, setLines] = React.useState<Line[]>([]);
  const [note, setNote] = React.useState("");
  const [voidConfirmOpen, setVoidConfirmOpen] = React.useState(false);

  React.useEffect(() => {
    if (open && sale) {
      setLines(linesFromSale(sale, products));
      setNote(sale.note?.trim() ?? "");
    }
  }, [open, sale, products]);

  const updateMut = useMutation({
    mutationFn: async (payload: {
      saleId: string;
      items: { productId: string; quantity: number }[];
      note: string;
    }) => updateSaleClient(profile?.id, payload),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(appendSyncHint("Sale updated · stock corrected"));
      onOpenChange(false);
      invalidateShopData(queryClient);
    },
  });

  const voidMut = useMutation({
    mutationFn: (saleId: string) => voidSaleClient(profile?.id, saleId),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(appendSyncHint("Sale removed · stock restored"));
      setVoidConfirmOpen(false);
      onOpenChange(false);
      invalidateShopData(queryClient);
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

  function saveEdits() {
    if (!sale) return;
    if (!lines.length) {
      toast.error("Leave at least one product, or use “Remove sale”");
      return;
    }
    if (lines.some((l) => !products.some((p) => p.id === l.product.id))) {
      toast.error(
        "Replace orphan lines using search — one product is missing from inventory",
      );
      return;
    }
    updateMut.mutate({
      saleId: sale.id,
      items: lines.map((l) => ({
        productId: l.product.id,
        quantity: l.quantity,
      })),
      note,
    });
  }

  function confirmVoidSale() {
    if (!sale) return;
    voidMut.mutate(sale.id);
  }

  const busy = updateMut.isPending || voidMut.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit recorded sale</DialogTitle>
            <DialogDescription>
              Fix the wrong product, quantities, or remove the sale if it never
              happened. Stock totals are recomputed safely from the catalogue.
            </DialogDescription>
            {sale ? (
              <p className="text-xs font-mono text-muted-foreground">
                Saved {format(new Date(sale.createdAt), "PPpp")}
              </p>
            ) : null}
          </DialogHeader>

          {sale ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="edit-sale-note">Note (optional)</Label>
                <Input
                  id="edit-sale-note"
                  placeholder="Receipt note…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <ProductScanCombo
                products={products}
                onPick={(p) => addProduct(p, 1)}
                autoFocus={false}
                id="edit-sale-scan"
                label="Add or fix products"
                placeholder="Scan barcode or type product name — pick from list"
              />
              <Separator />

              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No lines yet — scan products above or remove this sale
                  entirely using the button below.
                </p>
              ) : (
                <ul className="space-y-4">
                  {lines.map((line) => {
                    const live = products.find((p) => p.id === line.product.id);
                    const stockShown =
                      live?.stockQuantity ?? line.product.stockQuantity;
                    return (
                    <li
                      key={line.product.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 p-3"
                    >
                      <div className="min-w-[140px] flex-1">
                        <div className="font-medium">{line.product.name}</div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {formatMoney(line.product.sellingPrice)} each · stock{" "}
                            {stockShown}
                          </span>
                          {isLowStock(stockShown) ? (
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
                          className="shrink-0"
                          disabled={busy}
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
                          disabled={busy}
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
                          className="shrink-0"
                          disabled={busy}
                          onClick={() =>
                            setQty(line.product.id, line.quantity + 1)
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
                          disabled={busy}
                          onClick={() =>
                            setLines((prev) =>
                              prev.filter((l) => l.product.id !== line.product.id),
                            )
                          }
                        >
                          <Trash2 className="size-5" />
                        </Button>
                      </div>
                      <div className="w-full text-right text-base font-semibold tabular-nums sm:w-auto">
                        {formatMoney(line.product.sellingPrice * line.quantity)}
                      </div>
                    </li>
                    );
                  })}
                </ul>
              )}
              {sale ? (
                <div className="text-base font-semibold tabular-nums">
                  Revised total · {formatMoney(subtotal)}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !sale}
              onClick={() => setVoidConfirmOpen(true)}
            >
              Remove this sale…
            </Button>
            <Button
              type="button"
              size="lg"
              className="min-h-11"
              disabled={busy || !lines.length || updateMut.isPending}
              onClick={() => saveEdits()}
            >
              {updateMut.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={voidConfirmOpen} onOpenChange={setVoidConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this sale?</AlertDialogTitle>
            <AlertDialogDescription>
              The sale disappears from history and quantities go back onto the
              shelf. Use this if nothing was actually sold.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel disabled={voidMut.isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={voidMut.isPending || !sale}
              onClick={() => confirmVoidSale()}
            >
              {voidMut.isPending ? "Removing…" : "Yes — remove sale"}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
