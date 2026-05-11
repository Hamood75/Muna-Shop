"use client";

import { db } from "@/lib/db";
import { DashboardClient } from "@/features/dashboard/dashboard-client";
import { LoadingState } from "@/components/loading-state";

export default function DashboardPage() {
  const { isLoading, error, data } = db.useQuery({
    products: {},
    sales: {
      items: {
        product: {},
      },
    },
    stockMovements: {
      product: {},
    },
  });

  if (isLoading) return <LoadingState />;
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">
        {error.message}
      </div>
    );
  }

  return (
    <DashboardClient
      products={data.products ?? []}
      sales={data.sales ?? []}
      stockMovements={data.stockMovements ?? []}
    />
  );
}
