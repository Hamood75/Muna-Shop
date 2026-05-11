"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { InstaQLEntity } from "@instantdb/react";
import type { AppSchema } from "@/instant.schema";
import { isLowStock } from "@/lib/constants";
import { formatMoney } from "@/lib/format-money";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  appendSyncHint,
  deleteProductClient,
} from "@/lib/client-db-write";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Product = InstaQLEntity<AppSchema, "products">;

export function ProductTable({
  products,
  onEdit,
}: {
  products: Product[];
  onEdit: (p: Product) => void;
}) {
  const del = useMutation({
    mutationFn: deleteProductClient,
    onSuccess: (res) => {
      if (!res.ok) toast.error(res.error);
      else toast.success(appendSyncHint("Product deleted", res.syncStatus));
    },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4 pb-2">
        <CardTitle className="text-base md:text-lg">Catalog</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto px-2 pb-4 md:px-5">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/90 bg-muted/40">
              <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Product
              </th>
              <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Barcode
              </th>
              <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Buy
              </th>
              <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sell
              </th>
              <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Stock
              </th>
              <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr
                key={p.id}
                className="border-b border-border/60 transition-colors hover:bg-muted/35"
              >
                <td className="px-3 py-3.5 font-medium">{p.name}</td>
                <td className="px-3 py-3.5 font-mono text-sm text-muted-foreground">
                  {p.barcode ?? "-"}
                </td>
                <td className="px-3 py-3.5 text-right tabular-nums">
                  {formatMoney(p.buyingPrice)}
                </td>
                <td className="px-3 py-3.5 text-right tabular-nums">
                  {formatMoney(p.sellingPrice)}
                </td>
                <td className="px-3 py-3.5 text-right">
                  <Badge
                    variant={isLowStock(p.stockQuantity) ? "warning" : "secondary"}
                  >
                    {p.stockQuantity}
                  </Badge>
                </td>
                <td className="px-3 py-3.5 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label={`Edit ${p.name}`}
                      onClick={() => onEdit(p)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          aria-label={`Delete ${p.name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete product?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes "{p.name}" from the catalog. Linked sale
                            history remains for reporting.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="flex justify-end gap-2">
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            type="button"
                            onClick={() => del.mutate(p.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </div>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
