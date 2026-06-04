"use client";

import {
  BarChart3,
  CalendarDays,
  Download,
  Package,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportsDailyTab } from "@/features/reports/reports-daily-tab";
import { ReportsExportTab } from "@/features/reports/reports-export-tab";
import { ReportsOverviewTab } from "@/features/reports/reports-overview-tab";
import { ReportsProductsTab } from "@/features/reports/reports-products-tab";
import type { ReportsData } from "@/features/reports/reports-types";
import { useShopSession } from "@/context/shop-session";
import { ROLES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function ReportsClient({
  sales,
  products,
  stockMovements,
  cashCollections,
}: ReportsData) {
  const { profile } = useShopSession();
  const isSuperAdmin = profile?.role === ROLES.super_admin;

  const data: ReportsData = {
    sales,
    products,
    stockMovements,
    cashCollections,
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/[0.04] p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Revenue charts, daily cash ledger, product margins, and spreadsheet
          exports — sales and plan payments counted on the day money was received.
        </p>
      </header>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList
          className={cn(
            "grid h-auto w-full gap-1 p-1",
            isSuperAdmin ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3",
          )}
        >
          <TabsTrigger value="overview" className="gap-2 px-3 py-2.5 text-sm">
            <BarChart3 className="size-4 shrink-0" aria-hidden />
            <span className="truncate">Overview</span>
          </TabsTrigger>
          {isSuperAdmin ? (
            <TabsTrigger value="daily" className="gap-2 px-3 py-2.5 text-sm">
              <CalendarDays className="size-4 shrink-0" aria-hidden />
              <span className="truncate">Daily ledger</span>
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="products" className="gap-2 px-3 py-2.5 text-sm">
            <Package className="size-4 shrink-0" aria-hidden />
            <span className="truncate">Products</span>
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2 px-3 py-2.5 text-sm">
            <Download className="size-4 shrink-0" aria-hidden />
            <span className="truncate">Export</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <ReportsOverviewTab {...data} />
        </TabsContent>
        {isSuperAdmin ? (
          <TabsContent value="daily" className="mt-6">
            <ReportsDailyTab {...data} />
          </TabsContent>
        ) : null}
        <TabsContent value="products" className="mt-6">
          <ReportsProductsTab {...data} />
        </TabsContent>
        <TabsContent value="export" className="mt-6">
          <ReportsExportTab {...data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
