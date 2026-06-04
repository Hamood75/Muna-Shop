"use client";

import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState } from "@/components/loading-state";
import { InstallmentPlansList } from "@/features/installments/installment-plans-list";
import { NewInstallmentPanel } from "@/features/installments/new-installment-panel";
import { PlanPaymentsList } from "@/features/plan-payments/plan-payments-list";
import {
  fetchAllProducts,
  fetchCashCollections,
  fetchInstallmentsBundle,
} from "@/lib/queries";
import { queryKeys } from "@/lib/query-keys";

export function InstallmentsPage() {
  const { isLoading, error, data } = useQuery({
    queryKey: queryKeys.installments(),
    queryFn: async () => {
      const [products, plans, cashCollections] = await Promise.all([
        fetchAllProducts(),
        fetchInstallmentsBundle(),
        fetchCashCollections(),
      ]);
      return { products, plans, cashCollections };
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
    <Tabs defaultValue="plans" className="w-full space-y-6">
      <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-2 lg:inline-flex lg:h-10 lg:w-auto">
        <TabsTrigger value="plans" className="text-base">
          Installment plans
        </TabsTrigger>
        <TabsTrigger value="paid" className="text-base">
          Paid in installments & pay later
        </TabsTrigger>
      </TabsList>
      <TabsContent value="plans" className="space-y-8">
        <NewInstallmentPanel products={data?.products ?? []} />
        <InstallmentPlansList
          plans={data?.plans ?? []}
          products={data?.products ?? []}
        />
      </TabsContent>
      <TabsContent value="paid">
        <PlanPaymentsList collections={data?.cashCollections ?? []} />
      </TabsContent>
    </Tabs>
  );
}
