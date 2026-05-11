"use client";

import { db } from "@/lib/db";
import { LoadingState } from "@/components/loading-state";
import { ReportsClient } from "@/features/reports/reports-client";

export default function ReportsPage() {
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
      <div className="rounded-xl border border-destructive/40 p-4 text-destructive">
        {error.message}
      </div>
    );
  }

  return (
    <ReportsClient
      sales={data?.sales ?? []}
      products={data?.products ?? []}
      stockMovements={data?.stockMovements ?? []}
    />
  );
}
