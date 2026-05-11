"use client";

import { db } from "@/lib/db";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState } from "@/components/loading-state";
import { NewInstallmentPanel } from "@/features/installments/new-installment-panel";
import { InstallmentPlansList } from "@/features/installments/installment-plans-list";

export default function InstallmentsPage() {
  const { isLoading, error, data } = db.useQuery({
    products: {},
    installmentPlans: {
      items: { product: {} },
      creator: {},
    },
  });

  if (isLoading) return <LoadingState />;
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 p-4 text-destructive">
        {error.message}
      </div>
    );
  }

  return (
    <Tabs defaultValue="new" className="w-full">
      <TabsList className="grid w-full grid-cols-2 lg:inline-flex lg:w-auto">
        <TabsTrigger value="new" className="text-base">
          New plan
        </TabsTrigger>
        <TabsTrigger value="plans" className="text-base">
          Plans
        </TabsTrigger>
      </TabsList>
      <TabsContent value="new">
        <NewInstallmentPanel products={data.products ?? []} />
      </TabsContent>
      <TabsContent value="plans">
        <InstallmentPlansList plans={data.installmentPlans ?? []} />
      </TabsContent>
    </Tabs>
  );
}
