"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import type { CreditDebt, Product } from "@/lib/entities";
import { useShopSession } from "@/context/shop-session";
import {
  appendSyncHint,
  updateCreditDebtClient,
  voidCreditDebtClient,
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

type Props = {
  debt: CreditDebt | null;
  products: Product[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditCreditDebtDialog({
  debt,
  products,
  open,
  onOpenChange,
}: Props) {
  const { profile } = useShopSession();
  const queryClient = useQueryClient();
  const [customerName, setCustomerName] = React.useState("");
  const [product, setProduct] = React.useState<Product | null>(null);
  const [quantity, setQuantity] = React.useState(1);
  const [totalOwedStr, setTotalOwedStr] = React.useState("");
  const [totalManual, setTotalManual] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [voidConfirmOpen, setVoidConfirmOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open || !debt) return;
    setCustomerName(debt.customerName);
    setNotes(debt.notes?.trim() ?? "");
    setQuantity(debt.quantity);
    setTotalOwedStr(debt.totalOwed.toFixed(2));
    setTotalManual(true);
    const pid = debt.productId ?? debt.product?.id;
    const p =
      (pid ? products.find((x) => x.id === pid) : null) ??
      debt.product ??
      (pid
        ? {
            id: pid,
            name: "Product no longer found — search to replace",
            barcode: null,
            buyingPrice: 0,
            sellingPrice: debt.unitPriceAtSale,
            stockQuantity: 0,
            imageUrl: null,
            createdAt: 0,
          }
        : null);
    setProduct(p);
  }, [open, debt, products]);

  const defaultTotal =
    product != null ? product.sellingPrice * quantity : null;

  React.useEffect(() => {
    if (!open || !product || totalManual) return;
    if (defaultTotal != null) {
      setTotalOwedStr(defaultTotal.toFixed(2));
    }
  }, [open, product, defaultTotal, totalManual]);

  const updateMut = useMutation({
    mutationFn: (payload: {
      debtId: string;
      customerName: string;
      productId: string;
      quantity: number;
      totalOwed: number;
      notes: string;
    }) => updateCreditDebtClient(profile?.id, payload),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(appendSyncHint("Pay-later record updated · stock corrected"));
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.root });
    },
  });

  const voidMut = useMutation({
    mutationFn: (debtId: string) => voidCreditDebtClient(profile?.id, debtId),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(appendSyncHint("Record removed · stock restored"));
      setVoidConfirmOpen(false);
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.root });
    },
  });

  function pickProduct(p: Product) {
    setProduct(p);
    setTotalManual(false);
    toast.message(`Product · ${p.name}`, { duration: 1200 });
  }

  function saveEdits() {
    if (!debt) return;
    const name = customerName.trim();
    if (!name) {
      toast.error("Customer name is required");
      return;
    }
    if (!product) {
      toast.error("Choose a product");
      return;
    }
    if (!products.some((p) => p.id === product.id)) {
      toast.error("Replace the product using search above");
      return;
    }
    if (!isPositiveSaleQuantity(quantity)) {
      toast.error("Quantity must be greater than zero (e.g. 0.5, 1.25)");
      return;
    }
    const owed = Number.parseFloat(totalOwedStr);
    if (!Number.isFinite(owed) || owed <= 0) {
      toast.error("Enter a valid amount owed");
      return;
    }
    updateMut.mutate({
      debtId: debt.id,
      customerName: name,
      productId: product.id,
      quantity,
      totalOwed: owed,
      notes,
    });
  }

  const busy = updateMut.isPending || voidMut.isPending;
  const paidSoFar = debt?.paidSoFar ?? 0;
  const owedPreview = Number.parseFloat(totalOwedStr);
  const owedValid = Number.isFinite(owedPreview) && owedPreview > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit pay-later record</DialogTitle>
            <DialogDescription>
              Fix customer, product, quantity, or amount owed. Payments already
              recorded are kept (capped if the new balance is lower).
            </DialogDescription>
            {debt ? (
              <p className="text-xs font-mono text-muted-foreground">
                Saved {format(new Date(debt.createdAt), "PPpp")}
              </p>
            ) : null}
          </DialogHeader>

          {debt ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="edit-credit-customer">Customer name</Label>
                <Input
                  id="edit-credit-customer"
                  value={customerName}
                  disabled={busy}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-credit-notes">Notes (optional)</Label>
                <Input
                  id="edit-credit-notes"
                  value={notes}
                  disabled={busy}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <p className="text-sm text-muted-foreground tabular-nums">
                Paid so far · {formatMoney(paidSoFar)}
                {owedValid && owedPreview < paidSoFar ? (
                  <span className="block text-amber-600 dark:text-amber-400">
                    New balance is below amount paid — it will be adjusted.
                  </span>
                ) : null}
              </p>

              <ProductScanCombo
                products={products}
                onPick={(p) => pickProduct(p)}
                autoFocus={false}
                id="edit-credit-scan"
                label="Product"
                placeholder="Scan barcode to add — or type product name and pick from the list"
              />
              <Separator />

              {product ? (
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <div className="font-medium">{product.name}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      List price {formatMoney(product.sellingPrice)} · stock{" "}
                      {products.find((p) => p.id === product.id)?.stockQuantity ??
                        product.stockQuantity}
                    </span>
                    {isLowStock(
                      products.find((p) => p.id === product.id)?.stockQuantity ??
                        product.stockQuantity,
                    ) ? (
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
                      disabled={busy}
                      aria-label="Decrease quantity"
                      onClick={() =>
                        setQuantity((q) => {
                          const next = bumpSaleQuantity(q, -1);
                          return isPositiveSaleQuantity(next) ? next : q;
                        })
                      }
                    >
                      <Minus className="size-5" />
                    </Button>
                    <Input
                      className="w-20 text-center font-mono text-lg"
                      inputMode="decimal"
                      placeholder="0.5"
                      value={quantity}
                      disabled={busy}
                      onChange={(e) =>
                        setQuantity(parseSaleQuantity(e.target.value))
                      }
                    />
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      disabled={busy}
                      aria-label="Increase quantity"
                      onClick={() =>
                        setQuantity((q) => bumpSaleQuantity(q, 1))
                      }
                    >
                      <Plus className="size-5" />
                    </Button>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="edit-credit-total">Amount owed</Label>
                    <Input
                      id="edit-credit-total"
                      className="max-w-xs tabular-nums"
                      inputMode="decimal"
                      value={totalOwedStr}
                      disabled={busy}
                      onChange={(e) => {
                        setTotalManual(true);
                        setTotalOwedStr(e.target.value);
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Pick a product above.
                </p>
              )}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !debt}
              onClick={() => setVoidConfirmOpen(true)}
            >
              Remove this record…
            </Button>
            <Button
              type="button"
              size="lg"
              className="min-h-11"
              disabled={busy || !product || updateMut.isPending}
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
            <AlertDialogTitle>Remove this pay-later record?</AlertDialogTitle>
            <AlertDialogDescription>
              The IOU is deleted and stock is restored. Use only if the customer
              never took the goods.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel disabled={voidMut.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={voidMut.isPending || !debt}
              onClick={() => debt && voidMut.mutate(debt.id)}
            >
              {voidMut.isPending ? "Removing…" : "Yes — remove record"}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
