"use client";

import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState } from "@/components/loading-state";
import { CreditDebtsList } from "@/features/pay-later/credit-debts-list";
import { NewCreditDebtPanel } from "@/features/pay-later/new-credit-debt-panel";
import { PlanPaymentsList } from "@/features/plan-payments/plan-payments-list";
import {
  fetchAllProducts,
  fetchCashCollections,
  fetchCreditDebtsBundle,
} from "@/lib/queries";
import { queryKeys } from "@/lib/query-keys";

export function PayLaterPage() {
  const { isLoading, error, data } = useQuery({
    queryKey: queryKeys.payLater(),
    queryFn: async () => {
      const [products, debts, cashCollections] = await Promise.all([
        fetchAllProducts(),
        fetchCreditDebtsBundle(),
        fetchCashCollections(),
      ]);
      return { products, debts, cashCollections };
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
    <Tabs defaultValue="balances" className="w-full space-y-6">
      <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-2 lg:inline-flex lg:h-10 lg:w-auto">
        <TabsTrigger value="balances" className="text-base">
          Customer balances
        </TabsTrigger>
        <TabsTrigger value="paid" className="text-base">
          Paid in installments & pay later
        </TabsTrigger>
      </TabsList>
      <TabsContent value="balances" className="space-y-8">
        <NewCreditDebtPanel products={data?.products ?? []} />
        <CreditDebtsList
          debts={data?.debts ?? []}
          products={data?.products ?? []}
        />
      </TabsContent>
      <TabsContent value="paid">
        <PlanPaymentsList collections={data?.cashCollections ?? []} />
      </TabsContent>
    </Tabs>
  );
}
