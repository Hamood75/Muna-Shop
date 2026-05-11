"use client";

import { db } from "@/lib/db";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState } from "@/components/loading-state";
import { NewSalePanel } from "@/features/sales/new-sale-panel";
import { SalesHistory } from "@/features/sales/sales-history";

export default function SalesPage() {
  const { isLoading, error, data } = db.useQuery({
    products: {},
    sales: {
      items: {
        product: {},
      },
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
          New sale
        </TabsTrigger>
        <TabsTrigger value="history" className="text-base">
          History
        </TabsTrigger>
      </TabsList>
      <TabsContent value="new">
        <NewSalePanel products={data.products ?? []} />
      </TabsContent>
      <TabsContent value="history">
        <SalesHistory sales={data.sales ?? []} />
      </TabsContent>
    </Tabs>
  );
}
