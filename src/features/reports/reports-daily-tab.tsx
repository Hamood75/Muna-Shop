"use client";

import * as React from "react";
import { endOfDay, format, parseISO, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DayCashEntry, ReportsData } from "@/features/reports/reports-types";
import { fileStamp } from "@/features/reports/reports-types";
import { REPORTS_SALES_BY_DATE_PAGE_SIZE } from "@/lib/constants";
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

function collectionLabel(kind: string): string {
  return planPaymentTypeLabelLong(kind);
}

export function ReportsDailyTab({
  sales,
  cashCollections,
  stockMovements,
  products,
}: ReportsData) {
  const [salesDate, setSalesDate] = React.useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const [page, setPage] = React.useState(0);

  const dateBounds = React.useMemo(() => {
    const d = parseISO(salesDate);
    if (Number.isNaN(d.getTime())) return null;
    return {
      start: startOfDay(d).getTime(),
      end: endOfDay(d).getTime(),
    };
  }, [salesDate]);

  const salesOnDate = React.useMemo(() => {
    if (!dateBounds) return [];
    return [...sales]
      .filter(
        (s) =>
          s.createdAt >= dateBounds.start && s.createdAt <= dateBounds.end,
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [sales, dateBounds]);

  const collectionsOnDate = React.useMemo(() => {
    if (!dateBounds) return [];
    return collectionsInRange(
      cashCollections,
      dateBounds.start,
      dateBounds.end,
    ).sort((a, b) => b.paidAt - a.paidAt);
  }, [cashCollections, dateBounds]);

  const entries = React.useMemo((): DayCashEntry[] => {
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
  }, [salesOnDate, collectionsOnDate]);

  const metrics = React.useMemo(() => {
    if (!dateBounds) return null;
    const revenue = grossRevenueInRange(
      sales,
      cashCollections,
      dateBounds.start,
      dateBounds.end,
    );
    const tx = cashTransactionCountInRange(
      sales,
      cashCollections,
      dateBounds.start,
      dateBounds.end,
    );
    const pl = estimatedNetProfitInRange(
      sales,
      stockMovements,
      products,
      dateBounds.start,
      dateBounds.end,
    );
    return {
      revenue,
      tx,
      grossFromSales: pl.grossFromSales,
      damagedAtCost: pl.damagedAtCost,
      netEstimate: pl.netEstimate,
    };
  }, [sales, cashCollections, stockMovements, products, dateBounds]);

  const pageSize = REPORTS_SALES_BY_DATE_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  const pageClamped = Math.min(page, pageCount - 1);
  const pageItems = entries.slice(
    pageClamped * pageSize,
    pageClamped * pageSize + pageSize,
  );

  React.useEffect(() => {
    setPage(0);
  }, [salesDate]);

  React.useEffect(() => {
    if (page !== pageClamped) setPage(pageClamped);
  }, [page, pageClamped]);

  function exportDay() {
    if (!dateBounds) return;
    const headers = [
      "Type",
      "Date (ISO)",
      "Reference ID",
      "Amount",
      "Customer / note",
      "Detail",
    ];
    const rows = [...entries]
      .sort((a, b) => a.at - b.at)
      .map((entry) => {
        if (entry.kind === "sale") {
          return [
            "Sale",
            new Date(entry.sale.createdAt).toISOString(),
            entry.sale.id,
            formatMoney(entry.sale.totalAmount),
            entry.sale.note ?? "",
            `${(entry.sale.items ?? []).length} line items`,
          ];
        }
        return [
          collectionLabel(entry.collection.sourceKind),
          new Date(entry.collection.paidAt).toISOString(),
          entry.collection.sourceId,
          formatMoney(entry.collection.amount),
          entry.collection.customerName,
          entry.collection.note ?? "",
        ];
      });
    downloadCsv(
      `reports-cash-${salesDate}-${fileStamp()}.csv`,
      toCsv(headers, rows),
    );
  }

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/15">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-lg">Daily ledger</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Review every sale and plan payment for a specific calendar day.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <Label htmlFor="report-sales-date">Date</Label>
              <Input
                id="report-sales-date"
                type="date"
                value={salesDate}
                onChange={(e) => setSalesDate(e.target.value)}
                className="h-11 w-full min-w-[11rem] cursor-pointer sm:w-auto"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer gap-2"
              onClick={() => exportDay()}
              disabled={entries.length === 0}
            >
              <Download className="size-4" aria-hidden />
              Export day
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {!dateBounds ? (
          <p className="text-sm text-muted-foreground">Choose a valid date.</p>
        ) : metrics ? (
          <>
            <div className="rounded-xl border border-border bg-gradient-to-br from-muted/40 to-muted/10 p-5">
              <p className="text-sm font-medium">
                {format(parseISO(salesDate), "EEEE, MMM d, yyyy")}
              </p>
              <p className="mt-3 text-3xl font-semibold tabular-nums">
                {formatMoney(metrics.revenue)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {metrics.tx}{" "}
                {metrics.tx === 1 ? "transaction" : "transactions"}
              </p>
              <div className="mt-4 grid gap-2 border-t border-border/70 pt-4 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">Gross profit</p>
                  <p className="font-medium tabular-nums">
                    {formatMoney(metrics.grossFromSales)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Damaged @ cost</p>
                  <p className="font-medium tabular-nums text-destructive">
                    {metrics.damagedAtCost > 0
                      ? formatMoney(-metrics.damagedAtCost)
                      : formatMoney(metrics.damagedAtCost)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Est. net profit</p>
                  <p className="font-medium tabular-nums text-primary">
                    {formatMoney(metrics.netEstimate)}
                  </p>
                </div>
              </div>
            </div>

            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sales or plan payments on this date.
              </p>
            ) : (
              <>
                <ul className="space-y-3">
                  {pageItems.map((entry) =>
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
                            {format(new Date(entry.collection.paidAt), "PPpp")}
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
                {entries.length > pageSize ? (
                  <div className="flex flex-col gap-3 border-t border-border/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      {pageSize} per page · {entries.length} total
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="cursor-pointer gap-1"
                        disabled={pageClamped <= 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                      >
                        <ChevronLeft className="size-4" aria-hidden />
                        Previous
                      </Button>
                      <span className="min-w-[5rem] text-center text-sm tabular-nums text-muted-foreground">
                        Page {pageClamped + 1} of {pageCount}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="cursor-pointer gap-1"
                        disabled={pageClamped >= pageCount - 1}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                        <ChevronRight className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
