"use client";

import * as React from "react";
import { startOfDay, startOfMonth, startOfWeek, subDays } from "date-fns";
import { Coins, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueChart } from "@/features/reports/revenue-chart";
import type { PeriodMetrics, ReportsData } from "@/features/reports/reports-types";
import { formatMoney } from "@/lib/format-money";
import { estimatedNetProfitInRange } from "@/lib/pl-report";
import {
  buildRevenueSeries,
  type RevenueGranularity,
} from "@/lib/revenue-series";
import {
  cashTransactionCountInRange,
  grossRevenueInRange,
} from "@/lib/revenue";
import { cn } from "@/lib/utils";

function usePeriodMetrics({
  sales,
  cashCollections,
  stockMovements,
  products,
  installmentPlans,
  creditDebts,
}: ReportsData): PeriodMetrics[] {
  return React.useMemo(() => {
    const now = Date.now();
    const day = startOfDay(new Date()).getTime();
    const week = startOfWeek(new Date(), { weekStartsOn: 1 }).getTime();
    const month = startOfMonth(new Date()).getTime();
    const window7 = subDays(new Date(), 7).getTime();
    const planContext = {
      cashCollections,
      installmentPlans,
      creditDebts,
    };

    function periodMetrics(label: string, from: number): PeriodMetrics {
      const revenue = grossRevenueInRange(sales, cashCollections, from, now);
      const tx = cashTransactionCountInRange(
        sales,
        cashCollections,
        from,
        now,
      );
      const pl = estimatedNetProfitInRange(
        sales,
        stockMovements,
        products,
        from,
        now,
        planContext,
      );
      return {
        label,
        revenue,
        tx,
        grossFromSales: pl.grossFromSales,
        damagedAtCost: pl.damagedAtCost,
        netEstimate: pl.netEstimate,
      };
    }

    return [
      periodMetrics("Today", day),
      periodMetrics("This week", week),
      periodMetrics("This month", month),
      periodMetrics("Rolling 7 days", window7),
    ];
  }, [sales, cashCollections, stockMovements, products, installmentPlans, creditDebts]);
}

function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 p-4 transition-colors",
        accent
          ? "bg-gradient-to-br from-primary/10 to-card"
          : "bg-muted/20",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function ReportsOverviewTab(props: ReportsData) {
  const [granularity, setGranularity] =
    React.useState<RevenueGranularity>("day");

  const periods = usePeriodMetrics(props);

  const buckets = React.useMemo(
    () =>
      buildRevenueSeries(
        props.sales,
        props.cashCollections,
        granularity,
      ),
    [props.sales, props.cashCollections, granularity],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {periods.map((p, i) => (
          <StatTile
            key={p.label}
            label={p.label}
            value={formatMoney(p.revenue)}
            hint={`${p.tx} transactions · net ${formatMoney(p.netEstimate)}`}
            accent={i === 0}
          />
        ))}
      </div>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/15 pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/12 p-2.5 text-primary">
                <TrendingUp className="size-5" aria-hidden />
              </div>
              <div>
                <CardTitle className="text-lg">Revenue trend</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  POS sales plus installment and pay-later payments, grouped by
                  the day, month, or year they were received.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["day", "Days"],
                  ["month", "Months"],
                  ["year", "Year"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={
                    granularity === key
                      ? "cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm"
                      : "cursor-pointer rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60"
                  }
                  onClick={() => setGranularity(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <RevenueChart buckets={buckets} granularity={granularity} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {periods.map((p) => (
          <Card
            key={p.label}
            className="border-border/80 transition-shadow hover:shadow-md"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium">{p.label}</CardTitle>
              <Coins className="size-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatMoney(p.revenue)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {p.tx} transactions
                </p>
              </div>
              <div className="space-y-1.5 border-t border-border/70 pt-3 text-sm">
                <div className="flex justify-between gap-2 tabular-nums">
                  <span className="text-muted-foreground">Gross profit</span>
                  <span>{formatMoney(p.grossFromSales)}</span>
                </div>
                <div className="flex justify-between gap-2 tabular-nums">
                  <span className="text-muted-foreground">Damaged @ cost</span>
                  <span className="text-destructive">
                    {p.damagedAtCost > 0
                      ? formatMoney(-p.damagedAtCost)
                      : formatMoney(p.damagedAtCost)}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-t border-border/50 pt-2 font-semibold tabular-nums">
                  <span>Est. net profit</span>
                  <span className="text-primary">
                    {formatMoney(p.netEstimate)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
