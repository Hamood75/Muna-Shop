"use client";

import { useQuery } from "@tanstack/react-query";
import { LoadingState } from "@/components/loading-state";
import { CreditDebtsList } from "@/features/pay-later/credit-debts-list";
import { NewCreditDebtPanel } from "@/features/pay-later/new-credit-debt-panel";
import { fetchAllProducts, fetchCreditDebtsBundle } from "@/lib/queries";
import { queryKeys } from "@/lib/query-keys";

export function PayLaterPage() {
  const { isLoading, error, data } = useQuery({
    queryKey: queryKeys.payLater(),
    queryFn: async () => {
      const [products, debts] = await Promise.all([
        fetchAllProducts(),
        fetchCreditDebtsBundle(),
      ]);
      return { products, debts };
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
      <NewCreditDebtPanel products={data?.products ?? []} />
      <CreditDebtsList debts={data?.debts ?? []} />
    </div>
  );
}
