import { useQuery } from "@tanstack/react-query";
import { LoadingState } from "@/components/loading-state";
import { DashboardClient } from "@/features/dashboard/dashboard-client";
import { queryKeys } from "@/lib/query-keys";
import { fetchDashboardBundle } from "@/lib/queries";

export function DashboardPage() {
  const { isLoading, error, data } = useQuery({
    queryKey: queryKeys.dashboard(),
    queryFn: fetchDashboardBundle,
  });

  if (isLoading && !data) return <LoadingState />;
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">
        {error instanceof Error ? error.message : "Failed to load"}
      </div>
    );
  }

  const d = data ?? { products: [], sales: [], stockMovements: [] };
  return (
    <DashboardClient
      products={d.products}
      sales={d.sales}
      stockMovements={d.stockMovements}
    />
  );
}
