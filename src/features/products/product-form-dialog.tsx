"use client";

import * as React from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Product } from "@/lib/entities";
import {
  productCreateSchema,
  productUpdateSchema,
} from "@/lib/validations/inventory";
import { z } from "zod";
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

type FormValues = z.infer<typeof productCreateSchema>;

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
  const form = useForm<FormValues>({
    resolver: zodResolver(productCreateSchema) as Resolver<FormValues>,
    defaultValues: {
      name: "",
      barcode: "",
      buyingPrice: 0,
      sellingPrice: 0,
      stockQuantity: 0,
    },
  });

  React.useEffect(() => {
    if (editing) {
      form.reset({
        name: editing.name,
        barcode: editing.barcode ?? "",
        buyingPrice: editing.buyingPrice,
        sellingPrice: editing.sellingPrice,
        stockQuantity: editing.stockQuantity,
      });
    } else {
      form.reset({
        name: "",
        barcode: "",
        buyingPrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
      });
    }
  }, [editing, form, open]);

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

  function onSubmit(values: FormValues) {
    const payload = {
      ...values,
      barcode: values.barcode || undefined,
    };

    if (editing) {
      const parsed = productUpdateSchema.safeParse({
        ...payload,
        id: editing.id,
      });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Invalid form");
        return;
      }
      updateMut.mutate(parsed.data);
    } else {
      createMut.mutate(payload);
    }
  }

  const pending = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>
            Barcode is optional but must be unique when set.
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
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-barcode">Barcode</Label>
            <Input id="p-barcode" {...form.register("barcode")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="p-buy">Buying price</Label>
              <Input id="p-buy" type="number" step="0.01" {...form.register("buyingPrice")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-sell">Selling price</Label>
              <Input id="p-sell" type="number" step="0.01" {...form.register("sellingPrice")} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-stock">Stock quantity</Label>
            <Input id="p-stock" type="number" {...form.register("stockQuantity")} />
          </div>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : editing ? "Save changes" : "Create product"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
