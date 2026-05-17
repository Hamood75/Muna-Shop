"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { InventoryAdjustCard } from "@/features/inventory/inventory-adjust-card";
import { StockMovementList } from "@/features/inventory/stock-movement-list";
import { Button } from "@/components/ui/button";
import { STOCK_MOVEMENTS_PAGE_SIZE } from "@/lib/constants";
import { fetchAllProducts, fetchStockMovementsPage } from "@/lib/queries";
import type { Product, StockMovement } from "@/lib/entities";
import { queryKeys } from "@/lib/query-keys";

export function InventoryPage() {
  const [page, setPage] = React.useState(0);

  const productsQuery = useQuery({
    queryKey: [...queryKeys.root, "all-products"],
    queryFn: fetchAllProducts,
  });

  const movementsQuery = useQuery({
    queryKey: queryKeys.inventory(page),
    queryFn: () => fetchStockMovementsPage(page, STOCK_MOVEMENTS_PAGE_SIZE),
  });

  const products = (productsQuery.data ?? []) as Product[];
  const movements = (movementsQuery.data?.movements ?? []) as StockMovement[];
  const hasNextPage = movementsQuery.data?.hasNextPage ?? false;
  const hasPreviousPage = movementsQuery.data?.hasPreviousPage ?? false;
  const isLoading =
    (productsQuery.isLoading && !productsQuery.data) ||
    (movementsQuery.isLoading && !movementsQuery.data);
  const error = productsQuery.error ?? movementsQuery.error;

  React.useEffect(() => {
    if (!movementsQuery.isLoading && movements.length === 0 && page > 0) {
      setPage(0);
    }
  }, [movementsQuery.isLoading, movements.length, page]);

  if (isLoading) return <LoadingState />;
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 p-4 text-destructive">
        {error instanceof Error ? error.message : "Failed to load"}
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
              {movementsQuery.isLoading ? " · updating…" : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer gap-1"
                disabled={!hasPreviousPage || movementsQuery.isLoading}
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
                disabled={!hasNextPage || movementsQuery.isLoading}
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
