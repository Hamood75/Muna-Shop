"use client";

import * as React from "react";
import {
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DayCashEntry, ReportsData } from "@/features/reports/reports-types";
import { fileStamp } from "@/features/reports/reports-types";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney } from "@/lib/format-money";
import { formatQuantityDisplay } from "@/lib/quantity";
import { estimatedNetProfitInRange } from "@/lib/pl-report";
import {
  cashTransactionCountInRange,
  collectionsInRange,
  grossRevenueInRange,
  planPaymentTypeLabelLong,
} from "@/lib/revenue";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type DayMetrics = {
  dateKey: string;
  revenue: number;
  tx: number;
};

function formatMoneyShort(amount: number): string {
  if (amount === 0) return "";
  const n = Math.abs(amount);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}

function buildCalendarDays(month: Date): Date[] {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days: Date[] = [];
  let cursor = calStart;
  while (cursor <= calEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

function collectionLabel(kind: string): string {
  return planPaymentTypeLabelLong(kind);
}

export function ReportsMonthTab({
  sales,
  cashCollections,
  stockMovements,
  products,
  installmentPlans,
  creditDebts,
}: ReportsData) {
  const [month, setMonth] = React.useState(() => startOfMonth(new Date()));
  const [selectedDateKey, setSelectedDateKey] = React.useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );

  const monthBounds = React.useMemo(
    () => ({
      start: startOfMonth(month).getTime(),
      end: endOfMonth(month).getTime(),
    }),
    [month],
  );

  const monthKey = format(month, "yyyy-MM");
  const planContext = React.useMemo(
    () => ({ cashCollections, installmentPlans, creditDebts }),
    [cashCollections, installmentPlans, creditDebts],
  );

  const dayMetricsByKey = React.useMemo(() => {
    const map = new Map<string, DayMetrics>();
    const days = buildCalendarDays(month);

    for (const day of days) {
      const dateKey = format(day, "yyyy-MM-dd");
      const start = startOfDay(day).getTime();
      const end = endOfDay(day).getTime();
      map.set(dateKey, {
        dateKey,
        revenue: grossRevenueInRange(sales, cashCollections, start, end),
        tx: cashTransactionCountInRange(sales, cashCollections, start, end),
      });
    }
    return map;
  }, [month, sales, cashCollections]);

  const monthMetrics = React.useMemo(() => {
    const revenue = grossRevenueInRange(
      sales,
      cashCollections,
      monthBounds.start,
      monthBounds.end,
    );
    const tx = cashTransactionCountInRange(
      sales,
      cashCollections,
      monthBounds.start,
      monthBounds.end,
    );
    const pl = estimatedNetProfitInRange(
      sales,
      stockMovements,
      products,
      monthBounds.start,
      monthBounds.end,
      planContext,
    );
    const activeDays = buildCalendarDays(month).filter((day) => {
      if (!isSameMonth(day, month)) return false;
      const key = format(day, "yyyy-MM-dd");
      return (dayMetricsByKey.get(key)?.tx ?? 0) > 0;
    }).length;

    return {
      revenue,
      tx,
      activeDays,
      grossFromSales: pl.grossFromSales,
      damagedAtCost: pl.damagedAtCost,
      netEstimate: pl.netEstimate,
    };
  }, [
    sales,
    cashCollections,
    stockMovements,
    products,
    planContext,
    monthBounds,
    dayMetricsByKey,
  ]);

  const calendarDays = React.useMemo(() => buildCalendarDays(month), [month]);

  const selectedBounds = React.useMemo(() => {
    const d = parseISO(selectedDateKey);
    if (Number.isNaN(d.getTime())) return null;
    return {
      start: startOfDay(d).getTime(),
      end: endOfDay(d).getTime(),
    };
  }, [selectedDateKey]);

  const selectedEntries = React.useMemo((): DayCashEntry[] => {
    if (!selectedBounds) return [];
    const salesOnDate = [...sales]
      .filter(
        (s) =>
          s.createdAt >= selectedBounds.start &&
          s.createdAt <= selectedBounds.end,
      )
      .sort((a, b) => b.createdAt - a.createdAt);
    const collectionsOnDate = collectionsInRange(
      cashCollections,
      selectedBounds.start,
      selectedBounds.end,
    ).sort((a, b) => b.paidAt - a.paidAt);

    const saleEntries: DayCashEntry[] = salesOnDate.map((sale) => ({
      kind: "sale",
      at: sale.createdAt,
      id: sale.id,
      amount: sale.totalAmount,
      sale,
    }));
    const collectionEntries: DayCashEntry[] = collectionsOnDate.map(
      (collection) => ({
        kind: "collection",
        at: collection.paidAt,
        id: collection.id,
        amount: collection.amount,
        collection,
      }),
    );
    return [...saleEntries, ...collectionEntries].sort((a, b) => b.at - a.at);
  }, [sales, cashCollections, selectedBounds]);

  const selectedDayMetrics = dayMetricsByKey.get(selectedDateKey);

  React.useEffect(() => {
    const selected = parseISO(selectedDateKey);
    if (!isSameMonth(selected, month)) {
      setSelectedDateKey(format(startOfMonth(month), "yyyy-MM-dd"));
    }
  }, [month, selectedDateKey]);

  function goToPrevMonth() {
    setMonth((m) => subMonths(m, 1));
  }

  function goToNextMonth() {
    setMonth((m) => addMonths(m, 1));
  }

  function exportMonth() {
    const headers = ["Date", "Revenue", "Transactions"];
    const rows: (string | number)[][] = [];
    for (const day of calendarDays) {
      if (!isSameMonth(day, month)) continue;
      const key = format(day, "yyyy-MM-dd");
      const metrics = dayMetricsByKey.get(key);
      rows.push([
        key,
        formatMoney(metrics?.revenue ?? 0),
        metrics?.tx ?? 0,
      ]);
    }
    rows.push([
      "Month total",
      formatMoney(monthMetrics.revenue),
      monthMetrics.tx,
    ]);
    downloadCsv(
      `reports-month-${monthKey}-${fileStamp()}.csv`,
      toCsv(headers, rows),
    );
  }

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/15">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-lg">Month sales</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Calendar view of daily revenue — sales and plan payments on the
              day money was received.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <Label htmlFor="report-month">Month</Label>
              <Input
                id="report-month"
                type="month"
                value={monthKey}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) return;
                  const parsed = parseISO(`${value}-01`);
                  if (!Number.isNaN(parsed.getTime())) {
                    setMonth(startOfMonth(parsed));
                  }
                }}
                className="h-11 w-full min-w-[11rem] cursor-pointer sm:w-auto"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer gap-2"
              onClick={() => exportMonth()}
            >
              <Download className="size-4" aria-hidden />
              Export month
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer gap-1"
            onClick={goToPrevMonth}
          >
            <ChevronLeft className="size-4" aria-hidden />
            Previous
          </Button>
          <h2 className="text-lg font-semibold tabular-nums">
            {format(month, "MMMM yyyy")}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer gap-1"
            onClick={goToNextMonth}
          >
            Next
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-gradient-to-br from-muted/40 to-muted/10 p-5">
          <p className="text-sm font-medium">{format(month, "MMMM yyyy")}</p>
          <p className="mt-3 text-3xl font-semibold tabular-nums">
            {formatMoney(monthMetrics.revenue)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {monthMetrics.tx}{" "}
            {monthMetrics.tx === 1 ? "transaction" : "transactions"} across{" "}
            {monthMetrics.activeDays}{" "}
            {monthMetrics.activeDays === 1 ? "day" : "days"}
          </p>
          <div className="mt-4 grid gap-2 border-t border-border/70 pt-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground">Gross profit</p>
              <p className="font-medium tabular-nums">
                {formatMoney(monthMetrics.grossFromSales)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Damaged @ cost</p>
              <p className="font-medium tabular-nums text-destructive">
                {monthMetrics.damagedAtCost > 0
                  ? formatMoney(-monthMetrics.damagedAtCost)
                  : formatMoney(monthMetrics.damagedAtCost)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Est. net profit</p>
              <p className="font-medium tabular-nums text-primary">
                {formatMoney(monthMetrics.netEstimate)}
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[20rem]">
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {label}
                </div>
              ))}
              {calendarDays.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const inMonth = isSameMonth(day, month);
                const metrics = dayMetricsByKey.get(dateKey);
                const hasActivity = (metrics?.tx ?? 0) > 0;
                const isSelected = selectedDateKey === dateKey;
                const today = isToday(day);

                return (
                  <button
                    key={dateKey}
                    type="button"
                    disabled={!inMonth}
                    onClick={() => {
                      if (inMonth) setSelectedDateKey(dateKey);
                    }}
                    className={cn(
                      "flex min-h-[4.5rem] flex-col rounded-lg border p-2 text-left transition-colors sm:min-h-[5.5rem]",
                      !inMonth && "cursor-default border-transparent opacity-30",
                      inMonth &&
                        "cursor-pointer border-border/70 bg-card hover:bg-muted/50",
                      inMonth &&
                        hasActivity &&
                        "border-primary/25 bg-primary/[0.04]",
                      isSelected &&
                        inMonth &&
                        "ring-2 ring-primary ring-offset-2 ring-offset-background",
                      today && inMonth && !isSelected && "border-primary/40",
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-medium tabular-nums",
                        today && inMonth && "text-primary",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {inMonth && hasActivity ? (
                      <>
                        <span className="mt-1 text-xs font-semibold tabular-nums text-primary">
                          {formatMoneyShort(metrics?.revenue ?? 0)}
                        </span>
                        <span className="text-[0.65rem] text-muted-foreground">
                          {metrics?.tx}{" "}
                          {metrics?.tx === 1 ? "tx" : "txs"}
                        </span>
                      </>
                    ) : inMonth ? (
                      <span className="mt-1 text-[0.65rem] text-muted-foreground">
                        —
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {selectedBounds && selectedDayMetrics ? (
          <div className="space-y-4 border-t border-border/80 pt-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {format(parseISO(selectedDateKey), "EEEE, MMM d, yyyy")}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatMoney(selectedDayMetrics.revenue)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedDayMetrics.tx}{" "}
                  {selectedDayMetrics.tx === 1
                    ? "transaction"
                    : "transactions"}
                </p>
              </div>
            </div>

            {selectedEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sales or plan payments on this date.
              </p>
            ) : (
              <ul className="space-y-3">
                {selectedEntries.map((entry) =>
                  entry.kind === "sale" ? (
                    <li
                      key={`sale-${entry.id}`}
                      className="rounded-xl border border-border bg-muted/25 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Sale
                          </p>
                          <p className="text-sm font-semibold tabular-nums">
                            {formatMoney(entry.sale.totalAmount)}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(entry.sale.createdAt), "PPpp")}
                        </p>
                      </div>
                      {entry.sale.note ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {entry.sale.note}
                        </p>
                      ) : null}
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {(entry.sale.items ?? []).map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between gap-2 tabular-nums"
                          >
                            <span>
                              {item.product?.name ?? "Product"} ×{" "}
                              {formatQuantityDisplay(item.quantity)}
                            </span>
                            <span>{formatMoney(item.lineTotal)}</span>
                          </div>
                        ))}
                      </div>
                    </li>
                  ) : (
                    <li
                      key={`collection-${entry.id}`}
                      className="rounded-xl border border-border bg-muted/25 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {collectionLabel(entry.collection.sourceKind)}
                          </p>
                          <p className="text-sm font-semibold tabular-nums">
                            {formatMoney(entry.collection.amount)}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(
                            new Date(entry.collection.paidAt),
                            "PPpp",
                          )}
                        </p>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {entry.collection.customerName}
                        {entry.collection.note
                          ? ` · ${entry.collection.note}`
                          : ""}
                      </p>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
