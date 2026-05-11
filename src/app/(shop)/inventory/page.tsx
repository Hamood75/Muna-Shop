"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { InventoryAdjustCard } from "@/features/inventory/inventory-adjust-card";
import { StockMovementList } from "@/features/inventory/stock-movement-list";
import { Button } from "@/components/ui/button";
import { STOCK_MOVEMENTS_PAGE_SIZE } from "@/lib/constants";
import type { InstaQLEntity } from "@instantdb/react";
import type { AppSchema } from "@/instant.schema";

type Product = InstaQLEntity<AppSchema, "products">;
type Movement = InstaQLEntity<AppSchema, "stockMovements"> & {
  product?: InstaQLEntity<AppSchema, "products"> | null;
};

export default function InventoryPage() {
  const [page, setPage] = React.useState(0);

  const query = React.useMemo(
    () => ({
      products: {},
      stockMovements: {
        $: {
          order: { createdAt: "desc" as const },
          limit: STOCK_MOVEMENTS_PAGE_SIZE,
          offset: page * STOCK_MOVEMENTS_PAGE_SIZE,
        },
        product: {},
      },
    }),
    [page],
  );

  const { isLoading, error, data, pageInfo } = db.useQuery(query);

  const products = (data?.products ?? []) as Product[];
  const movements = (data?.stockMovements ?? []) as Movement[];
  const pi = pageInfo?.stockMovements;
  const hasNextPage = pi?.hasNextPage ?? false;
  const hasPreviousPage = pi?.hasPreviousPage ?? false;

  React.useEffect(() => {
    if (!isLoading && movements.length === 0 && page > 0) {
      setPage(0);
    }
  }, [isLoading, movements.length, page]);

  if (isLoading && !data) return <LoadingState />;
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 p-4 text-destructive">
        {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {products.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Add products before recording stock movements."
        />
      ) : (
        <InventoryAdjustCard products={products} />
      )}
      <StockMovementList
        movements={movements}
        paginationFooter={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing up to {STOCK_MOVEMENTS_PAGE_SIZE} movements per page
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
        }
      />
    </div>
  );
}
