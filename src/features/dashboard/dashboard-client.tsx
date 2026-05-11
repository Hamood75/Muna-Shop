"use client";

import * as React from "react";
import { startOfDay, startOfMonth, startOfWeek } from "date-fns";
import type { InstaQLEntity } from "@instantdb/react";
import type { AppSchema } from "@/instant.schema";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Coins,
  Package,
  type LucideIcon,
} from "lucide-react";
import {
  DASHBOARD_RECENT_SALES_PAGE_SIZE,
  LOW_STOCK_THRESHOLD,
  isLowStock,
} from "@/lib/constants";
import { formatMoney } from "@/lib/format-money";
import { estimatedNetProfitInRange } from "@/lib/pl-report";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type Product = InstaQLEntity<AppSchema, "products">;
type SaleItem = InstaQLEntity<AppSchema, "saleItems"> & {
  product?: InstaQLEntity<AppSchema, "products"> | null;
};

type Sale = InstaQLEntity<AppSchema, "sales"> & {
  items?: SaleItem[];
};

type StockMovement = InstaQLEntity<AppSchema, "stockMovements"> & {
  product?: InstaQLEntity<AppSchema, "products"> | null;
};

export function DashboardClient({
  products,
  sales,
  stockMovements,
}: {
  products: Product[];
  sales: Sale[];
  stockMovements: StockMovement[];
}) {
  const [recentSalesPage, setRecentSalesPage] = React.useState(0);

  const stats = React.useMemo(() => {
    const sod = startOfDay(new Date()).getTime();
    const sow = startOfWeek(new Date(), { weekStartsOn: 1 }).getTime();
    const som = startOfMonth(new Date()).getTime();

    const salesToday = sales.filter((s) => s.createdAt >= sod);
    const revenueToday = salesToday.reduce((a, s) => a + s.totalAmount, 0);

    const salesWeek = sales.filter((s) => s.createdAt >= sow);
    const revenueWeek = salesWeek.reduce((a, s) => a + s.totalAmount, 0);

    const salesMonth = sales.filter((s) => s.createdAt >= som);
    const revenueMonth = salesMonth.reduce((a, s) => a + s.totalAmount, 0);

    const low = products.filter((p) => isLowStock(p.stockQuantity));

    const unitsByProduct = new Map<string, number>();
    for (const s of salesMonth) {
      for (const item of s.items ?? []) {
        const pid = item.product?.id;
        if (!pid) continue;
        unitsByProduct.set(pid, (unitsByProduct.get(pid) ?? 0) + item.quantity);
      }
    }

    const best = [...unitsByProduct.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, qty]) => ({
        id,
        product: products.find((p) => p.id === id),
        qty,
      }));

    const now = Date.now();
    const plMonth = estimatedNetProfitInRange(
      sales,
      stockMovements,
      products,
      som,
      now,
    );

    return {
      revenueToday,
      countToday: salesToday.length,
      revenueWeek,
      revenueMonth,
      lowStock: low.length,
      totalProducts: products.length,
      recentSalesSorted: [...sales].sort(
        (a, b) => b.createdAt - a.createdAt,
      ),
      best,
      grossProfitSalesMonth: plMonth.grossFromSales,
      damagedCostMonth: plMonth.damagedAtCost,
      profitEstNet: plMonth.netEstimate,
    };
  }, [products, sales, stockMovements]);

  const recentSorted = stats.recentSalesSorted;
  const rsPageSize = DASHBOARD_RECENT_SALES_PAGE_SIZE;

  React.useEffect(() => {
    const maxPage = Math.max(
      0,
      Math.ceil(recentSorted.length / rsPageSize) - 1,
    );
    setRecentSalesPage((p) => Math.min(p, maxPage));
  }, [recentSorted.length, rsPageSize]);

  const recentOffset = recentSalesPage * rsPageSize;
  const recentSalesPageItems = recentSorted.slice(
    recentOffset,
    recentOffset + rsPageSize,
  );
  const recentHasPrev = recentSalesPage > 0;
  const recentHasNext = recentOffset + rsPageSize < recentSorted.length;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Coins}
          title="Today's revenue"
          value={formatMoney(stats.revenueToday)}
          hint={`${stats.countToday} sales`}
        />
        <StatCard
          icon={CalendarDays}
          title="This week"
          value={formatMoney(stats.revenueWeek)}
          hint="Gross sales"
        />
        <StatCard
          icon={AlertTriangle}
          title="Low stock SKUs"
          value={String(stats.lowStock)}
          hint={`threshold ≤ ${LOW_STOCK_THRESHOLD}`}
          warning={stats.lowStock > 0}
        />
        <StatCard
          icon={Package}
          title="Products"
          value={String(stats.totalProducts)}
          hint="Active catalog"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent sales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentSorted.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sales yet.</p>
            ) : (
              <>
                {recentSalesPageItems.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-lg border border-border/80 bg-muted/20 px-3 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
                      <span className="text-sm text-muted-foreground">
                        {new Date(s.createdAt).toLocaleString()}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatMoney(s.totalAmount)}
                      </span>
                    </div>
                    {(s.items ?? []).length === 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        No line items recorded.
                      </p>
                    ) : (
                      <>
                        <div
                          className="mt-2 grid grid-cols-[minmax(0,1fr)_3rem_minmax(8rem,auto)] gap-2 text-xs font-medium text-muted-foreground"
                          aria-hidden
                        >
                          <span>Product</span>
                          <span className="text-right">Qty</span>
                          <span className="text-right">Price</span>
                        </div>
                        <ul className="mt-1 space-y-1">
                          {(s.items ?? []).map((item) => (
                            <li
                              key={item.id}
                              className="grid grid-cols-[minmax(0,1fr)_3rem_minmax(8rem,auto)] gap-2 text-sm"
                            >
                              <span className="truncate">
                                {item.product?.name ?? "Removed product"}
                              </span>
                              <span className="text-right tabular-nums">
                                {item.quantity}
                              </span>
                              <span className="text-right tabular-nums">
                                {formatMoney(item.unitPrice)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                ))}
                {recentSorted.length > rsPageSize ? (
                  <div className="flex flex-col gap-3 border-t border-border/80 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      {rsPageSize} per page · {recentSorted.length} total
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="cursor-pointer gap-1"
                        disabled={!recentHasPrev}
                        onClick={() =>
                          setRecentSalesPage((p) => Math.max(0, p - 1))
                        }
                      >
                        <ChevronLeft className="size-4" aria-hidden />
                        Previous
                      </Button>
                      <span className="min-w-[5rem] text-center text-sm tabular-nums text-muted-foreground">
                        Page {recentSalesPage + 1}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="cursor-pointer gap-1"
                        disabled={!recentHasNext}
                        onClick={() => setRecentSalesPage((p) => p + 1)}
                      >
                        Next
                        <ChevronRight className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Low stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {products.filter((p) => isLowStock(p.stockQuantity)).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All SKUs above threshold.
              </p>
            ) : (
              products
                .filter((p) => isLowStock(p.stockQuantity))
                .slice(0, 12)
                .map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-transparent bg-muted/30 px-3 py-2 text-sm transition-colors hover:border-border/80 hover:bg-muted/50"
                  >
                    <span className="font-medium">{p.name}</span>
                    <Badge variant="warning">{p.stockQuantity}</Badge>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Month snapshot</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Monthly revenue</p>
            <p className="text-3xl font-semibold tabular-nums">
              {formatMoney(stats.revenueMonth)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              Est. gross profit from sales (month)
            </p>
            <p className="text-3xl font-semibold tabular-nums">
              {formatMoney(stats.grossProfitSalesMonth)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              Damaged / shrink at cost (month)
            </p>
            <p className="text-3xl font-semibold tabular-nums text-destructive">
              {stats.damagedCostMonth > 0
                ? formatMoney(-stats.damagedCostMonth)
                : formatMoney(stats.damagedCostMonth)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Buying price × units marked damaged
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              Est. net profit (month)
            </p>
            <p className="text-3xl font-semibold tabular-nums text-primary">
              {formatMoney(stats.profitEstNet)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sales gross margin minus damaged COGS
            </p>
          </div>
          <Separator className="md:col-span-2" />
          <div className="md:col-span-2">
            <p className="mb-3 text-sm font-medium">Best sellers (units, MTD)</p>
            <div className="space-y-2">
              {stats.best.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data.</p>
              ) : (
                stats.best.map((row) => (
                  <div
                    key={row.id}
                    className="flex justify-between rounded-lg border border-border/80 bg-muted/15 px-3 py-2 text-sm transition-colors hover:bg-muted/35"
                  >
                    <span>{row.product?.name ?? "Removed product"}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {row.qty} units
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
  hint,
  warning,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  hint: string;
  warning?: boolean;
}) {
  return (
    <Card
      className={
        warning
          ? "border-amber-500/45 bg-gradient-to-br from-amber-500/[0.09] to-card dark:from-amber-500/[0.12]"
          : "hover:border-primary/20 hover:shadow-md"
      }
    >
      <CardHeader className="relative flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div
          className={
            warning
              ? "rounded-xl bg-amber-500/15 p-2 text-amber-700 dark:text-amber-300"
              : "rounded-xl bg-primary/10 p-2 text-primary"
          }
        >
          <Icon className="size-4" aria-hidden />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums tracking-tight">
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
