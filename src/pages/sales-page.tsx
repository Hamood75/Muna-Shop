"use client";

import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState } from "@/components/loading-state";
import { NewSalePanel } from "@/features/sales/new-sale-panel";
import { SalesHistory } from "@/features/sales/sales-history";
import { fetchAllProducts, fetchSalesBundle } from "@/lib/queries";
import { queryKeys } from "@/lib/query-keys";

export function SalesPage() {
  const { isLoading, error, data } = useQuery({
    queryKey: queryKeys.sales(),
    queryFn: async () => {
      const [products, sales] = await Promise.all([
        fetchAllProducts(),
        fetchSalesBundle(),
      ]);
      return { products, sales };
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
    <Tabs defaultValue="new" className="w-full">
      <TabsList className="grid w-full grid-cols-2 lg:inline-flex lg:w-auto">
        <TabsTrigger value="new" className="text-base">
          New sale
        </TabsTrigger>
        <TabsTrigger value="history" className="text-base">
          History
        </TabsTrigger>
      </TabsList>
      <TabsContent value="new">
        <NewSalePanel products={data?.products ?? []} />
      </TabsContent>
      <TabsContent value="history">
        <SalesHistory sales={data?.sales ?? []} />
      </TabsContent>
    </Tabs>
  );
}
