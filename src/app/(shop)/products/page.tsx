"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductTable } from "@/features/products/product-table";
import { ProductFormDialog } from "@/features/products/product-form-dialog";
import { PRODUCTS_PAGE_SIZE } from "@/lib/constants";
import type { InstaQLEntity } from "@instantdb/react";
import type { AppSchema } from "@/instant.schema";

type Product = InstaQLEntity<AppSchema, "products">;

export default function ProductsPage() {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(0);

  React.useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 320);
    return () => window.clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const query = React.useMemo(() => {
    const $base = {
      limit: PRODUCTS_PAGE_SIZE,
      offset: page * PRODUCTS_PAGE_SIZE,
      order: { createdAt: "desc" as const },
    };
    if (!debouncedSearch) {
      return { products: { $: $base } };
    }
    const pattern = `%${debouncedSearch}%`;
    return {
      products: {
        $: {
          ...$base,
          where: {
            or: [
              { name: { $ilike: pattern } },
              { barcode: { $ilike: pattern } },
            ],
          },
        },
      },
    };
  }, [page, debouncedSearch]);

  // InstaQL supports where.or; schema typings for `products` omit it today.
  // @ts-expect-error — OR filter on name/barcode for paginated search
  const { isLoading, error, data, pageInfo } = db.useQuery(query);

  const items = (data?.products ?? []) as Product[];
  const pi = pageInfo?.products;
  const hasNextPage = pi?.hasNextPage ?? false;
  const hasPreviousPage = pi?.hasPreviousPage ?? false;

  if (isLoading && !data) return <LoadingState />;
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 p-4 text-destructive">
        {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-[200px] max-w-md flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Search
          </label>
          <Input
            placeholder="Name or barcode"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          size="lg"
          className="min-h-12"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="size-5" aria-hidden />
          New product
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={debouncedSearch ? "No products match" : "No products yet"}
          description={
            debouncedSearch
              ? "Try another search or clear the filter."
              : "Add your first SKU to get started."
          }
        >
          {!debouncedSearch ? (
            <Button size="lg" onClick={() => setOpen(true)}>
              Create product
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <>
          <ProductTable
            products={items}
            onEdit={(p) => {
              setEditing(p);
              setOpen(true);
            }}
          />
          <div className="flex flex-col gap-3 border-t border-border/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {items.length} per page
              {debouncedSearch ? ` · filtered by search` : ""}
              {isLoading ? " · updating…" : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer gap-1"
                disabled={!hasPreviousPage || isLoading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Previous
              </Button>
              <span className="min-w-[5rem] text-center text-sm tabular-nums text-muted-foreground">
                Page {page + 1}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer gap-1"
                disabled={!hasNextPage || isLoading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        </>
      )}

      <ProductFormDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}
