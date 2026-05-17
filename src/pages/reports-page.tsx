"use client";

import { useQuery } from "@tanstack/react-query";
import { LoadingState } from "@/components/loading-state";
import { ReportsClient } from "@/features/reports/reports-client";
import { fetchDashboardBundle } from "@/lib/queries";
import { queryKeys } from "@/lib/query-keys";

export function ReportsPage() {
  const { isLoading, error, data } = useQuery({
    queryKey: queryKeys.reports(),
    queryFn: fetchDashboardBundle,
  });

  if (isLoading && !data) return <LoadingState />;
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 p-4 text-destructive">
        {error instanceof Error ? error.message : "Failed to load"}
      </div>
    );
  }

  const d = data ?? { products: [], sales: [], stockMovements: [] };
  return (
    <ReportsClient
      sales={d.sales}
      products={d.products}
      stockMovements={d.stockMovements}
    />
  );
}
