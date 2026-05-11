"use client";

import { db } from "@/lib/db";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState } from "@/components/loading-state";
import { NewCreditDebtPanel } from "@/features/pay-later/new-credit-debt-panel";
import { CreditDebtsList } from "@/features/pay-later/credit-debts-list";

export default function PayLaterPage() {
  const { isLoading, error, data } = db.useQuery({
    products: {},
    creditDebts: {
      product: {},
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
          New IOU
        </TabsTrigger>
        <TabsTrigger value="balances" className="text-base">
          Balances
        </TabsTrigger>
      </TabsList>
      <TabsContent value="new">
        <NewCreditDebtPanel products={data.products ?? []} />
      </TabsContent>
      <TabsContent value="balances">
        <CreditDebtsList debts={data.creditDebts ?? []} />
      </TabsContent>
    </Tabs>
  );
}
