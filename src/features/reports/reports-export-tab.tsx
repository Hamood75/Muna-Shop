"use client";

import * as React from "react";
import { startOfDay, startOfMonth, startOfWeek, subDays } from "date-fns";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fileStamp, type ReportsData } from "@/features/reports/reports-types";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney } from "@/lib/format-money";
import { estimatedNetProfitInRange } from "@/lib/pl-report";
import {
  cashTransactionCountInRange,
  grossRevenueInRange,
} from "@/lib/revenue";

export function ReportsExportTab({
  sales,
  cashCollections,
  stockMovements,
  products,
  installmentPlans,
  creditDebts,
}: ReportsData) {
  const periods = React.useMemo(() => {
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

    function periodMetrics(label: string, from: number) {
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

  const sortedSales = React.useMemo(
    () => [...sales].sort((a, b) => a.createdAt - b.createdAt),
    [sales],
  );

  function exportSummary() {
    const headers = [
      "Period",
      "Revenue",
      "Transactions",
      "Gross profit (sales)",
      "Damaged COGS",
      "Est. net profit",
    ];
    const rows = periods.map((p) => [
      p.label,
      formatMoney(p.revenue),
      p.tx,
      formatMoney(p.grossFromSales),
      formatMoney(p.damagedAtCost),
      formatMoney(p.netEstimate),
    ]);
    downloadCsv(`reports-summary-${fileStamp()}.csv`, toCsv(headers, rows));
  }

  function exportSales() {
    const headers = [
      "Sale date (ISO)",
      "Sale ID",
      "Total amount",
      "Note",
      "Line item count",
    ];
    const rows = sortedSales.map((s) => [
      new Date(s.createdAt).toISOString(),
      s.id,
      formatMoney(s.totalAmount),
      s.note ?? "",
      (s.items ?? []).length,
    ]);
    downloadCsv(`reports-sales-${fileStamp()}.csv`, toCsv(headers, rows));
  }

  function exportLineItems() {
    const headers = [
      "Sale date (ISO)",
      "Sale ID",
      "Sale total",
      "Note",
      "Product name",
      "Barcode",
      "Quantity",
      "Unit price",
      "Line total",
    ];
    const rows: (string | number)[][] = [];
    for (const s of sortedSales) {
      const dateIso = new Date(s.createdAt).toISOString();
      const note = s.note ?? "";
      const items = s.items ?? [];
      if (items.length === 0) {
        rows.push([
          dateIso,
          s.id,
          formatMoney(s.totalAmount),
          note,
          "",
          "",
          "",
          "",
          "",
        ]);
        continue;
      }
      for (const item of items) {
        const p = item.product;
        rows.push([
          dateIso,
          s.id,
          formatMoney(s.totalAmount),
          note,
          p?.name ?? "",
          p?.barcode ?? "",
          item.quantity,
          formatMoney(item.unitPrice),
          formatMoney(item.lineTotal),
        ]);
      }
    }
    downloadCsv(`reports-line-items-${fileStamp()}.csv`, toCsv(headers, rows));
  }

  const exports = [
    {
      title: "Period summary",
      description:
        "Today, week, month, and rolling 7-day revenue with profit estimates.",
      action: exportSummary,
      disabled: false,
    },
    {
      title: "All sales",
      description: "One row per sale with total and note.",
      action: exportSales,
      disabled: sales.length === 0,
    },
    {
      title: "Line items",
      description: "Every sale line with product, quantity, and price.",
      action: exportLineItems,
      disabled: sales.length === 0,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/15">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/12 p-2.5 text-primary">
              <FileSpreadsheet className="size-5" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-lg">Export data</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Download CSV files for Excel or Google Sheets (UTF-8 with BOM).
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          {exports.map((item) => (
            <div
              key={item.title}
              className="flex flex-col rounded-xl border border-border bg-muted/15 p-4"
            >
              <h3 className="font-medium">{item.title}</h3>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">
                {item.description}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 w-full cursor-pointer gap-2"
                onClick={() => item.action()}
                disabled={item.disabled}
              >
                <Download className="size-4" aria-hidden />
                Download
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
