"use client";

import * as React from "react";
import {
  useForm,
  useWatch,
  type FieldValues,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Product } from "@/lib/entities";
import {
  productCreateFormSchema,
  productCreateSchema,
  productEditFormSchema,
  productUpdateSchema,
} from "@/lib/validations/inventory";
import {
  appendSyncHint,
  createProductClient,
  updateProductClient,
} from "@/lib/write";
import { queryKeys } from "@/lib/query-keys";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format-money";

export function ProductFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Product | null;
}) {
  const queryClient = useQueryClient();

  const resolver = React.useMemo(
    () =>
      zodResolver(
        editing ? productEditFormSchema : productCreateFormSchema,
      ) as unknown as Resolver<FieldValues>,
    [editing],
  );

  const form = useForm<FieldValues>({
    resolver,
    defaultValues: {
      name: "",
      barcode: "",
      wholesaleLotTotal: 0,
      unitsPurchased: 1,
      openingStock: 1,
      sellingPrice: 0,
      buyingPrice: 0,
      stockQuantity: 0,
    },
  });

  React.useEffect(() => {
    if (open && editing) {
      form.reset({
        name: editing.name,
        barcode: editing.barcode ?? "",
        wholesaleLotTotal: editing.buyingPrice,
        unitsPurchased: 1,
        sellingPrice: editing.sellingPrice,
        stockQuantity: editing.stockQuantity,
      });
    } else if (open && !editing) {
      form.reset({
        name: "",
        barcode: "",
        wholesaleLotTotal: 0,
        unitsPurchased: 1,
        openingStock: 1,
        sellingPrice: 0,
        buyingPrice: 0,
        stockQuantity: 0,
      });
    }
  }, [editing, form, open]);

  const wholesaleWatch = useWatch({
    control: form.control,
    name: "wholesaleLotTotal",
    defaultValue: 0,
  });
  const unitsWatch = useWatch({
    control: form.control,
    name: "unitsPurchased",
    defaultValue: 1,
  });

  const costPreview = React.useMemo(() => {
    const wt = Number(wholesaleWatch);
    const u = Number(unitsWatch);
    if (!(u > 0) || !Number.isFinite(wt)) return null;
    return wt / u;
  }, [wholesaleWatch, unitsWatch]);

  const createMut = useMutation({
    mutationFn: createProductClient,
    onSuccess: async (res) => {
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(appendSyncHint("Product created"));
        onOpenChange(false);
        void queryClient.invalidateQueries({ queryKey: queryKeys.root });
      }
    },
  });

  const updateMut = useMutation({
    mutationFn: updateProductClient,
    onSuccess: async (res) => {
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(appendSyncHint("Product updated"));
        onOpenChange(false);
        void queryClient.invalidateQueries({ queryKey: queryKeys.root });
      }
    },
  });

  function onSubmit(values: FieldValues) {
    if (editing) {
      const stepped = productEditFormSchema.safeParse(values);
      if (!stepped.success) {
        toast.error(stepped.error.issues[0]?.message ?? "Invalid form");
        return;
      }
      const parsed = productUpdateSchema.safeParse({
        ...stepped.data,
        id: editing.id,
      });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Invalid form");
        return;
      }
      updateMut.mutate(parsed.data);
    } else {
      const parsed = productCreateSchema.safeParse(values);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Invalid form");
        return;
      }
      createMut.mutate({
        ...parsed.data,
        barcode: parsed.data.barcode || undefined,
      });
    }
  }

  const pending = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>
            {editing ? (
              <>
                Adjust name, barcode, wholesale purchase (we recalculate{" "}
                <strong>cost per unit</strong>), current stock, and selling price.
              </>
            ) : (
              <>
                Enter the <strong>total</strong> you paid for the wholesale pack and how many{" "}
                <strong>units</strong> were in that purchase. We store average{" "}
                <strong>cost per unit</strong> so profit on each sale stays accurate.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 pt-2"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="grid gap-2">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {String(form.formState.errors.name.message)}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-barcode">Barcode</Label>
            <Input id="p-barcode" {...form.register("barcode")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="p-wholesale-total">Wholesale total paid</Label>
              <Input
                id="p-wholesale-total"
                type="number"
                step="0.01"
                min={0}
                {...form.register("wholesaleLotTotal")}
              />
              <p className="text-xs text-muted-foreground">
                Total cash for the whole pack / lot (not per piece).
              </p>
              {form.formState.errors.wholesaleLotTotal ? (
                <p className="text-xs text-destructive">
                  {String(form.formState.errors.wholesaleLotTotal.message)}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-units">Units in this purchase</Label>
              <Input
                id="p-units"
                type="number"
                step="0.0001"
                min={0}
                {...form.register("unitsPurchased")}
              />
              <p className="text-xs text-muted-foreground">
                How many sellable units you got for that total (used to compute cost per unit).
              </p>
              {form.formState.errors.unitsPurchased ? (
                <p className="text-xs text-destructive">
                  {String(form.formState.errors.unitsPurchased.message)}
                </p>
              ) : null}
            </div>
          </div>
          {costPreview !== null && Number.isFinite(costPreview) ? (
            <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Cost per unit (saved): </span>
              <span className="font-medium tabular-nums">{formatMoney(costPreview)}</span>
            </p>
          ) : null}
          {editing ? (
            <div className="grid gap-2">
              <Label htmlFor="p-stock-edit">Stock quantity</Label>
              <Input
                id="p-stock-edit"
                type="number"
                step="1"
                min={0}
                {...form.register("stockQuantity")}
              />
              <p className="text-xs text-muted-foreground">
                Current units on hand. Does not need to match “units in this purchase”—that field is only for
                averaging your wholesale cost.
              </p>
              {form.formState.errors.stockQuantity ? (
                <p className="text-xs text-destructive">
                  {String(form.formState.errors.stockQuantity.message)}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="p-opening-stock">Opening stock</Label>
              <Input
                id="p-opening-stock"
                type="number"
                step="1"
                min={0}
                {...form.register("openingStock")}
              />
              <p className="text-xs text-muted-foreground">
                Usually the same as units purchased; lower if some items were damaged or missing.
              </p>
              {form.formState.errors.openingStock ? (
                <p className="text-xs text-destructive">
                  {String(form.formState.errors.openingStock.message)}
                </p>
              ) : null}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="p-sell">Selling price (per unit)</Label>
            <Input
              id="p-sell"
              type="number"
              step="0.01"
              {...form.register("sellingPrice")}
            />
            {form.formState.errors.sellingPrice ? (
              <p className="text-xs text-destructive">
                {String(form.formState.errors.sellingPrice.message)}
              </p>
            ) : null}
          </div>

          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : editing ? "Save changes" : "Create product"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
