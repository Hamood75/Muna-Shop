"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { InstallmentItem, InstallmentPlan, Product } from "@/lib/entities";
import { useShopSession } from "@/context/shop-session";
import {
  appendSyncHint,
  updateInstallmentPlanClient,
  voidInstallmentPlanClient,
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
import {
  bumpSaleQuantity,
  isPositiveSaleQuantity,
  parseSaleQuantity,
} from "@/lib/quantity";

type Line = { product: Product; quantity: number };

function productForItem(it: InstallmentItem, catalog: Product[]): Product | null {
  const pid = it.productId ?? it.product?.id;
  if (!pid) return null;
  const alive = catalog.find((p) => p.id === pid);
  if (alive) return alive;
  return {
    id: pid,
    name: "Product no longer found — search to replace",
    barcode: null,
    buyingPrice: 0,
    sellingPrice: it.unitPrice,
    stockQuantity: 0,
    imageUrl: null,
    createdAt: 0,
  };
}

function linesFromPlan(plan: InstallmentPlan, catalog: Product[]): Line[] {
  const grouped = new Map<string, Line>();
  for (const it of plan.items ?? []) {
    const p = productForItem(it, catalog);
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

type Props = {
  plan: InstallmentPlan | null;
  products: Product[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditInstallmentPlanDialog({
  plan,
  products,
  open,
  onOpenChange,
}: Props) {
  const { profile } = useShopSession();
  const queryClient = useQueryClient();
  const [customerName, setCustomerName] = React.useState("");
  const [lines, setLines] = React.useState<Line[]>([]);
  const [notes, setNotes] = React.useState("");
  const [voidConfirmOpen, setVoidConfirmOpen] = React.useState(false);

  React.useEffect(() => {
    if (open && plan) {
      setCustomerName(plan.customerName);
      setLines(linesFromPlan(plan, products));
      setNotes(plan.notes?.trim() ?? "");
    }
  }, [open, plan, products]);

  const updateMut = useMutation({
    mutationFn: (payload: {
      planId: string;
      customerName: string;
      items: { productId: string; quantity: number }[];
      notes: string;
    }) => updateInstallmentPlanClient(profile?.id, payload),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(appendSyncHint("Installment plan updated · stock corrected"));
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.root });
    },
  });

  const voidMut = useMutation({
    mutationFn: (planId: string) => voidInstallmentPlanClient(profile?.id, planId),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(appendSyncHint("Plan removed · stock restored"));
      setVoidConfirmOpen(false);
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.root });
    },
  });

  function addProduct(product: Product, qty = 1) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.product.id === product.id);
      if (idx === -1) return [...prev, { product, quantity: qty }];
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
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

  const subtotal = lines.reduce(
    (sum, l) => sum + l.product.sellingPrice * l.quantity,
    0,
  );

  function saveEdits() {
    if (!plan) return;
    const name = customerName.trim();
    if (!name) {
      toast.error("Customer name is required");
      return;
    }
    if (!lines.length) {
      toast.error("Leave at least one product, or remove this plan");
      return;
    }
    if (lines.some((l) => !products.some((p) => p.id === l.product.id))) {
      toast.error("Replace missing products using search above");
      return;
    }
    updateMut.mutate({
      planId: plan.id,
      customerName: name,
      items: lines.map((l) => ({
        productId: l.product.id,
        quantity: l.quantity,
      })),
      notes,
    });
  }

  const busy = updateMut.isPending || voidMut.isPending;
  const paidSoFar = plan?.paidSoFar ?? 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit installment plan</DialogTitle>
            <DialogDescription>
              Fix customer, products, or quantities. Payments already recorded
              are kept (capped if the new total is lower).
            </DialogDescription>
            {plan ? (
              <p className="text-xs font-mono text-muted-foreground">
                Saved {format(new Date(plan.createdAt), "PPpp")}
              </p>
            ) : null}
          </DialogHeader>

          {plan ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="edit-inst-customer">Customer name</Label>
                <Input
                  id="edit-inst-customer"
                  value={customerName}
                  disabled={busy}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-inst-notes">Notes (optional)</Label>
                <Input
                  id="edit-inst-notes"
                  value={notes}
                  disabled={busy}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <p className="text-sm text-muted-foreground tabular-nums">
                Paid so far · {formatMoney(paidSoFar)}
                {subtotal < paidSoFar ? (
                  <span className="block text-amber-600 dark:text-amber-400">
                    New total is below amount paid — balance will be adjusted.
                  </span>
                ) : null}
              </p>

              <ProductScanCombo
                products={products}
                onPick={(p) => addProduct(p, 1)}
                autoFocus={false}
                id="edit-inst-scan"
                label="Add or fix products"
                placeholder="Scan barcode to add — or type product name and pick from the list"
              />
              <Separator />

              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No products — add above or remove this plan.
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
                              <Badge
                                variant="warning"
                                className="text-[10px] uppercase"
                              >
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
                            disabled={busy}
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
                          <Input
                            className="w-20 text-center font-mono text-lg"
                            inputMode="decimal"
                            placeholder="0.5"
                            value={line.quantity}
                            disabled={busy}
                            onChange={(e) =>
                              setQty(
                                line.product.id,
                                parseSaleQuantity(e.target.value),
                              )
                            }
                          />
                          <Button
                            type="button"
                            size="lg"
                            variant="outline"
                            disabled={busy}
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
                            className="text-destructive [&_svg]:size-5"
                            disabled={busy}
                            aria-label="Remove line"
                            onClick={() =>
                              setLines((prev) =>
                                prev.filter(
                                  (l) => l.product.id !== line.product.id,
                                ),
                              )
                            }
                          >
                            <Trash2 className="size-5" />
                          </Button>
                        </div>
                        <div className="w-full text-right font-semibold tabular-nums sm:w-auto">
                          {formatMoney(
                            line.product.sellingPrice * line.quantity,
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="text-base font-semibold tabular-nums">
                Revised total · {formatMoney(subtotal)}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !plan}
              onClick={() => setVoidConfirmOpen(true)}
            >
              Remove this plan…
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
            <AlertDialogTitle>Remove this installment plan?</AlertDialogTitle>
            <AlertDialogDescription>
              The plan is deleted and stock is restored. Payment history on this
              plan is lost — only use if the sale was a mistake.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel disabled={voidMut.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={voidMut.isPending || !plan}
              onClick={() => plan && voidMut.mutate(plan.id)}
            >
              {voidMut.isPending ? "Removing…" : "Yes — remove plan"}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
