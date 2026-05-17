"use client";

import { useQuery } from "@tanstack/react-query";
import { LoadingState } from "@/components/loading-state";
import { InstallmentPlansList } from "@/features/installments/installment-plans-list";
import { NewInstallmentPanel } from "@/features/installments/new-installment-panel";
import { fetchAllProducts, fetchInstallmentsBundle } from "@/lib/queries";
import { queryKeys } from "@/lib/query-keys";

export function InstallmentsPage() {
  const { isLoading, error, data } = useQuery({
    queryKey: queryKeys.installments(),
    queryFn: async () => {
      const [products, plans] = await Promise.all([
        fetchAllProducts(),
        fetchInstallmentsBundle(),
      ]);
      return { products, plans };
    },
  });

  if (isLoading && !data) return <LoadingState />;
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 p-4 text-destructive">
        {error instanceof Error ? error.message : "Failed to load"}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <NewInstallmentPanel products={data?.products ?? []} />
      <InstallmentPlansList plans={data?.plans ?? []} />
    </div>
  );
}
