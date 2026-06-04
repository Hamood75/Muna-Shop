"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { ProductPicker } from "@/components/product-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fileStamp,
  selectLikeClass,
  type ReportsData,
} from "@/features/reports/reports-types";
import { cn } from "@/lib/utils";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney } from "@/lib/format-money";
import {
  allProductsProfitInRange,
  profitForProductInRange,
} from "@/lib/pl-report";
import { startOfDay, startOfMonth, startOfWeek, subDays } from "date-fns";

export function ReportsProductsTab({
  sales,
  products,
  stockMovements,
}: ReportsData) {
  const productPeriodPresets = React.useMemo(() => {
    const now = Date.now();
    return [
      {
        key: "today",
        label: "Today",
        start: startOfDay(new Date()).getTime(),
        end: now,
      },
      {
        key: "week",
        label: "This week",
        start: startOfWeek(new Date(), { weekStartsOn: 1 }).getTime(),
        end: now,
      },
      {
        key: "month",
        label: "This month",
        start: startOfMonth(new Date()).getTime(),
        end: now,
      },
      {
        key: "7d",
        label: "Rolling 7 days",
        start: subDays(new Date(), 7).getTime(),
        end: now,
      },
      { key: "all", label: "All time", start: 0, end: now },
    ] as const;
  }, []);

  const [periodKey, setPeriodKey] = React.useState<
    (typeof productPeriodPresets)[number]["key"]
  >("month");
  const [selectedProductId, setSelectedProductId] = React.useState("");
  const [tableFilter, setTableFilter] = React.useState("");

  const activeRange = React.useMemo(() => {
    const p = productPeriodPresets.find((x) => x.key === periodKey);
    return p ?? productPeriodPresets[2];
  }, [productPeriodPresets, periodKey]);

  const profitRows = React.useMemo(
    () =>
      allProductsProfitInRange(
        sales,
        stockMovements,
        products,
        activeRange.start,
        activeRange.end,
      ),
    [sales, stockMovements, products, activeRange.start, activeRange.end],
  );

  const filteredRows = React.useMemo(() => {
    const q = tableFilter.trim().toLowerCase();
    if (!q) return profitRows;
    return profitRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.barcode.toLowerCase().includes(q),
    );
  }, [profitRows, tableFilter]);

  React.useEffect(() => {
    setTableFilter("");
  }, [periodKey]);

  const selectedProfit = React.useMemo(() => {
    if (!selectedProductId) return null;
    return profitForProductInRange(
      sales,
      stockMovements,
      products,
      selectedProductId,
      activeRange.start,
      activeRange.end,
    );
  }, [
    sales,
    stockMovements,
    products,
    selectedProductId,
    activeRange.start,
    activeRange.end,
  ]);

  function exportProductProfits() {
    const label =
      productPeriodPresets.find((x) => x.key === periodKey)?.label ?? periodKey;
    const headers = [
      "Period",
      "Product",
      "Barcode",
      "Units sold",
      "Revenue",
      "Gross profit",
      "Damaged units",
      "Damaged @ cost",
      "Net contribution",
    ];
    const rows = profitRows.map((r) => [
      label,
      r.name,
      r.barcode,
      r.unitsSold,
      formatMoney(r.revenue),
      formatMoney(r.grossProfit),
      r.damagedUnits,
      formatMoney(r.damagedAtCost),
      formatMoney(r.netContribution),
    ]);
    downloadCsv(
      `reports-product-profit-${periodKey}-${fileStamp()}.csv`,
      toCsv(headers, rows),
    );
  }

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/15">
        <CardTitle className="text-lg">Profit by product</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Gross profit uses sale line price minus buying price; damaged stock
          uses buying price at write-off.
        </p>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="grid flex-1 gap-2 sm:max-w-xs">
            <Label htmlFor="report-period">Period</Label>
            <select
              id="report-period"
              className={cn(selectLikeClass, "cursor-pointer")}
              value={periodKey}
              onChange={(e) =>
                setPeriodKey(
                  e.target.value as (typeof productPeriodPresets)[number]["key"],
                )
              }
            >
              {productPeriodPresets.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid min-w-0 flex-[2] gap-2 sm:max-w-md">
            <Label htmlFor="report-product">Product</Label>
            <ProductPicker
              id="report-product"
              products={products}
              value={selectedProductId}
              onValueChange={setSelectedProductId}
              placeholder="Search or pick a product…"
              allowClear
              clearLabel="Clear product filter"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer gap-2 lg:shrink-0"
            onClick={() => exportProductProfits()}
            disabled={profitRows.length === 0}
          >
            <Download className="size-4" aria-hidden />
            Export CSV
          </Button>
        </div>

        {selectedProductId && selectedProfit ? (
          <div className="rounded-xl border border-border bg-muted/25 p-4">
            <p className="text-sm font-medium">{selectedProfit.name}</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Units sold</dt>
                <dd className="mt-0.5 font-semibold tabular-nums">
                  {selectedProfit.unitsSold}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Revenue</dt>
                <dd className="mt-0.5 font-semibold tabular-nums">
                  {formatMoney(selectedProfit.revenue)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Gross profit</dt>
                <dd className="mt-0.5 font-semibold tabular-nums">
                  {formatMoney(selectedProfit.grossProfit)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Damaged units</dt>
                <dd className="mt-0.5 font-semibold tabular-nums">
                  {selectedProfit.damagedUnits}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Damaged @ cost</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-destructive">
                  {selectedProfit.damagedAtCost > 0
                    ? formatMoney(-selectedProfit.damagedAtCost)
                    : formatMoney(selectedProfit.damagedAtCost)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Net contribution</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-primary">
                  {formatMoney(selectedProfit.netContribution)}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Pick a product to see revenue, margin, and damaged-stock impact for
            the selected period.
          </p>
        )}

        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h3 className="text-sm font-medium">
              Products with activity · {activeRange.label}
            </h3>
            <div className="w-full sm:max-w-xs">
              <Label htmlFor="profit-table-filter" className="sr-only">
                Filter table
              </Label>
              <Input
                id="profit-table-filter"
                placeholder="Filter by name or barcode…"
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                className="h-10"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Showing {filteredRows.length}
            {tableFilter.trim() ? ` of ${profitRows.length}` : ""}{" "}
            {filteredRows.length === 1 ? "product" : "products"}.
          </p>
          {profitRows.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No sales or damaged movements in this period.
            </p>
          ) : filteredRows.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing matches this filter.
            </p>
          ) : (
            <div className="mt-3 max-h-[min(480px,55vh)] overflow-auto rounded-xl border border-border">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead className="sticky top-0 z-[1] shadow-[0_1px_0_var(--border)]">
                  <tr className="border-b border-border bg-muted/95 backdrop-blur-sm">
                    <th className="px-3 py-2.5 text-left font-medium">
                      Product
                    </th>
                    <th className="px-3 py-2.5 font-medium tabular-nums">
                      Units
                    </th>
                    <th className="px-3 py-2.5 font-medium tabular-nums">
                      Revenue
                    </th>
                    <th className="px-3 py-2.5 font-medium tabular-nums">
                      Gross
                    </th>
                    <th className="px-3 py-2.5 font-medium tabular-nums">
                      Damaged
                    </th>
                    <th className="px-3 py-2.5 font-medium tabular-nums">
                      Net
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr
                      key={r.productId}
                      className={cn(
                        "border-b border-border/80 last:border-0 hover:bg-muted/30",
                        r.productId === selectedProductId &&
                          "bg-primary/8 dark:bg-primary/12",
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          className="cursor-pointer text-left font-medium underline-offset-2 hover:underline"
                          onClick={() => setSelectedProductId(r.productId)}
                        >
                          {r.name}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{r.unitsSold}</td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatMoney(r.revenue)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatMoney(r.grossProfit)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                        {r.damagedAtCost > 0
                          ? formatMoney(-r.damagedAtCost)
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-medium tabular-nums text-primary">
                        {formatMoney(r.netContribution)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
