"use client";

import * as React from "react";
import {
  endOfDay,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductPicker } from "@/components/product-picker";
import { useShopSession } from "@/context/shop-session";
import { REPORTS_SALES_BY_DATE_PAGE_SIZE, ROLES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney } from "@/lib/format-money";
import { formatQuantityDisplay } from "@/lib/quantity";
import {
  allProductsProfitInRange,
  estimatedNetProfitInRange,
  profitForProductInRange,
  type ProductPL,
  type SalePL,
  type StockMovementPL,
} from "@/lib/pl-report";

function fileStamp() {
  return new Date().toISOString().slice(0, 10);
}

const selectLikeClass =
  "flex h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export function ReportsClient({
  sales,
  products,
  stockMovements,
}: {
  sales: SalePL[];
  products: ProductPL[];
  stockMovements: StockMovementPL[];
}) {
  const { profile } = useShopSession();
  const isSuperAdmin = profile?.role === ROLES.super_admin;

  const [salesDate, setSalesDate] = React.useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const [salesDatePage, setSalesDatePage] = React.useState(0);

  const salesDateBounds = React.useMemo(() => {
    const d = parseISO(salesDate);
    if (Number.isNaN(d.getTime())) return null;
    return {
      start: startOfDay(d).getTime(),
      end: endOfDay(d).getTime(),
    };
  }, [salesDate]);

  const salesOnSelectedDate = React.useMemo(() => {
    if (!salesDateBounds) return [];
    return [...sales]
      .filter(
        (s) =>
          s.createdAt >= salesDateBounds.start &&
          s.createdAt <= salesDateBounds.end,
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [sales, salesDateBounds]);

  const salesDateMetrics = React.useMemo(() => {
    if (!salesDateBounds) return null;
    const revenue = salesOnSelectedDate.reduce((a, s) => a + s.totalAmount, 0);
    const pl = estimatedNetProfitInRange(
      sales,
      stockMovements,
      products,
      salesDateBounds.start,
      salesDateBounds.end,
    );
    return {
      revenue,
      tx: salesOnSelectedDate.length,
      grossFromSales: pl.grossFromSales,
      damagedAtCost: pl.damagedAtCost,
      netEstimate: pl.netEstimate,
    };
  }, [
    sales,
    stockMovements,
    products,
    salesDateBounds,
    salesOnSelectedDate,
  ]);

  const salesDatePageSize = REPORTS_SALES_BY_DATE_PAGE_SIZE;
  const salesDatePageCount = Math.max(
    1,
    Math.ceil(salesOnSelectedDate.length / salesDatePageSize),
  );
  const salesDatePageClamped = Math.min(salesDatePage, salesDatePageCount - 1);
  const salesDatePageItems = salesOnSelectedDate.slice(
    salesDatePageClamped * salesDatePageSize,
    salesDatePageClamped * salesDatePageSize + salesDatePageSize,
  );
  const salesDateHasPrev = salesDatePageClamped > 0;
  const salesDateHasNext = salesDatePageClamped < salesDatePageCount - 1;

  React.useEffect(() => {
    setSalesDatePage(0);
  }, [salesDate]);

  React.useEffect(() => {
    if (salesDatePage !== salesDatePageClamped) {
      setSalesDatePage(salesDatePageClamped);
    }
  }, [salesDatePage, salesDatePageClamped]);

  const periods = React.useMemo(() => {
    const now = Date.now();
    const day = startOfDay(new Date()).getTime();
    const week = startOfWeek(new Date(), { weekStartsOn: 1 }).getTime();
    const month = startOfMonth(new Date()).getTime();
    const window7 = subDays(new Date(), 7).getTime();

    function periodMetrics(from: number) {
      const revenue = sales
        .filter((s) => s.createdAt >= from && s.createdAt <= now)
        .reduce((a, s) => a + s.totalAmount, 0);

      const tx = sales.filter(
        (s) => s.createdAt >= from && s.createdAt <= now,
      ).length;

      const pl = estimatedNetProfitInRange(
        sales,
        stockMovements,
        products,
        from,
        now,
      );

      return {
        revenue,
        tx,
        grossFromSales: pl.grossFromSales,
        damagedAtCost: pl.damagedAtCost,
        netEstimate: pl.netEstimate,
      };
    }

    return [
      { label: "Today", ...periodMetrics(day) },
      { label: "This week", ...periodMetrics(week) },
      { label: "This month", ...periodMetrics(month) },
      { label: "Rolling 7 days", ...periodMetrics(window7) },
    ];
  }, [sales, products, stockMovements]);

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

  function exportSalesForDate() {
    if (!salesDateBounds) return;
    const headers = [
      "Sale date (ISO)",
      "Sale ID",
      "Total amount",
      "Note",
      "Line item count",
    ];
    const rows = [...salesOnSelectedDate]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((s) => [
        new Date(s.createdAt).toISOString(),
        s.id,
        formatMoney(s.totalAmount),
        s.note ?? "",
        (s.items ?? []).length,
      ]);
    downloadCsv(
      `reports-sales-${salesDate}-${fileStamp()}.csv`,
      toCsv(headers, rows),
    );
  }

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

  const [productPeriodKey, setProductPeriodKey] = React.useState<
    (typeof productPeriodPresets)[number]["key"]
  >("month");
  const [selectedProductId, setSelectedProductId] = React.useState("");
  const [profitTableFilter, setProfitTableFilter] = React.useState("");

  const activeProductRange = React.useMemo(() => {
    const p = productPeriodPresets.find((x) => x.key === productPeriodKey);
    return p ?? productPeriodPresets[2];
  }, [productPeriodPresets, productPeriodKey]);

  const productProfitRows = React.useMemo(
    () =>
      allProductsProfitInRange(
        sales,
        stockMovements,
        products,
        activeProductRange.start,
        activeProductRange.end,
      ),
    [
      sales,
      stockMovements,
      products,
      activeProductRange.start,
      activeProductRange.end,
    ],
  );

  const filteredProfitRows = React.useMemo(() => {
    const q = profitTableFilter.trim().toLowerCase();
    if (!q) return productProfitRows;
    return productProfitRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.barcode.toLowerCase().includes(q),
    );
  }, [productProfitRows, profitTableFilter]);

  React.useEffect(() => {
    setProfitTableFilter("");
  }, [productPeriodKey]);

  const selectedProductProfit = React.useMemo(() => {
    if (!selectedProductId) return null;
    return profitForProductInRange(
      sales,
      stockMovements,
      products,
      selectedProductId,
      activeProductRange.start,
      activeProductRange.end,
    );
  }, [
    sales,
    stockMovements,
    products,
    selectedProductId,
    activeProductRange.start,
    activeProductRange.end,
  ]);

  function exportProductProfits() {
    const label =
      productPeriodPresets.find((x) => x.key === productPeriodKey)?.label ??
      productPeriodKey;
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
    const rows = productProfitRows.map((r) => [
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
      `reports-product-profit-${productPeriodKey}-${fileStamp()}.csv`,
      toCsv(headers, rows),
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Export</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Download CSV files for spreadsheets (UTF-8 with BOM for Excel).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer gap-2"
              onClick={() => exportSummary()}
            >
              <Download className="size-4" aria-hidden />
              Summary
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer gap-2"
              onClick={() => exportSales()}
              disabled={sales.length === 0}
            >
              <Download className="size-4" aria-hidden />
              All sales
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer gap-2"
              onClick={() => exportLineItems()}
              disabled={sales.length === 0}
            >
              <Download className="size-4" aria-hidden />
              Line items
            </Button>
          </div>
        </CardHeader>
      </Card>

      {isSuperAdmin ? (
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">Sales by date</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick any calendar day to review revenue, margin, and each
                transaction for that day.
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
                onClick={() => exportSalesForDate()}
                disabled={salesOnSelectedDate.length === 0}
              >
                <Download className="size-4" aria-hidden />
                Export day (CSV)
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {!salesDateBounds ? (
              <p className="text-sm text-muted-foreground">
                Choose a valid date.
              </p>
            ) : salesDateMetrics ? (
              <>
                <div className="rounded-xl border border-border bg-muted/25 p-4">
                  <p className="text-sm font-medium">
                    {format(parseISO(salesDate), "EEEE, MMM d, yyyy")}
                  </p>
                  <div className="mt-4">
                    <p className="text-3xl font-semibold tabular-nums">
                      {formatMoney(salesDateMetrics.revenue)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Revenue · {salesDateMetrics.tx}{" "}
                      {salesDateMetrics.tx === 1 ? "transaction" : "transactions"}
                    </p>
                  </div>
                  <div className="mt-4 border-t border-border/80 pt-3 text-sm">
                    <div className="flex justify-between gap-2 tabular-nums">
                      <span className="text-muted-foreground">
                        Gross profit (sales)
                      </span>
                      <span>{formatMoney(salesDateMetrics.grossFromSales)}</span>
                    </div>
                    <div className="mt-2 flex justify-between gap-2 tabular-nums">
                      <span className="text-muted-foreground">
                        Damaged @ cost
                      </span>
                      <span className="text-destructive">
                        {salesDateMetrics.damagedAtCost > 0
                          ? formatMoney(-salesDateMetrics.damagedAtCost)
                          : formatMoney(salesDateMetrics.damagedAtCost)}
                      </span>
                    </div>
                    <div className="mt-3 flex justify-between gap-2 border-t border-border/60 pt-3 font-semibold tabular-nums">
                      <span>Est. net profit</span>
                      <span className="text-primary">
                        {formatMoney(salesDateMetrics.netEstimate)}
                      </span>
                    </div>
                  </div>
                </div>

                {salesOnSelectedDate.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No sales recorded on this date.
                  </p>
                ) : (
                  <>
                    <ul className="space-y-3">
                      {salesDatePageItems.map((sale) => (
                        <li
                          key={sale.id}
                          className="rounded-xl border border-border bg-muted/30 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="text-sm font-semibold tabular-nums">
                              {formatMoney(sale.totalAmount)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(sale.createdAt), "PPpp")}
                            </div>
                          </div>
                          {sale.note ? (
                            <p className="mt-2 text-sm text-muted-foreground">
                              {sale.note}
                            </p>
                          ) : null}
                          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                            {(sale.items ?? []).map((item) => (
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
                      ))}
                    </ul>
                    {salesOnSelectedDate.length > salesDatePageSize ? (
                      <div className="flex flex-col gap-3 border-t border-border/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                          {salesDatePageSize} per page · {salesOnSelectedDate.length}{" "}
                          total
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="cursor-pointer gap-1"
                            disabled={!salesDateHasPrev}
                            onClick={() =>
                              setSalesDatePage((p) => Math.max(0, p - 1))
                            }
                          >
                            <ChevronLeft className="size-4" aria-hidden />
                            Previous
                          </Button>
                          <span className="min-w-[5rem] text-center text-sm tabular-nums text-muted-foreground">
                            Page {salesDatePageClamped + 1} of {salesDatePageCount}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="cursor-pointer gap-1"
                            disabled={!salesDateHasNext}
                            onClick={() => setSalesDatePage((p) => p + 1)}
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
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profit by product</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Gross profit uses each sale line&apos;s unit price minus current
            buying price; damaged stock uses buying price at write-off time.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="grid flex-1 gap-2 sm:max-w-xs">
              <Label htmlFor="report-period">Period</Label>
              <select
                id="report-period"
                className={cn(selectLikeClass, "cursor-pointer")}
                value={productPeriodKey}
                onChange={(e) =>
                  setProductPeriodKey(
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
              disabled={productProfitRows.length === 0}
              title={
                productProfitRows.length === 0
                  ? undefined
                  : `Exports ${productProfitRows.length} SKU rows`
              }
            >
              <Download className="size-4" aria-hidden />
              Export product profits (CSV)
            </Button>
          </div>

          {selectedProductId && selectedProductProfit ? (
            <div className="rounded-xl border border-border bg-muted/25 p-4">
              <p className="text-sm font-medium">{selectedProductProfit.name}</p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Units sold</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">
                    {selectedProductProfit.unitsSold}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Revenue</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">
                    {formatMoney(selectedProductProfit.revenue)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Gross profit</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">
                    {formatMoney(selectedProductProfit.grossProfit)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Damaged units</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">
                    {selectedProductProfit.damagedUnits}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Damaged @ cost</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-destructive">
                    {selectedProductProfit.damagedAtCost > 0
                      ? formatMoney(-selectedProductProfit.damagedAtCost)
                      : formatMoney(selectedProductProfit.damagedAtCost)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Net contribution</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-primary">
                    {formatMoney(selectedProductProfit.netContribution)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pick a product above to see revenue, margin, and damaged-stock
              impact for the selected period.
            </p>
          )}

          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <h3 className="text-sm font-medium">
                All products with activity · {activeProductRange.label}
              </h3>
              <div className="w-full sm:max-w-xs">
                <Label htmlFor="profit-table-filter" className="sr-only">
                  Filter table
                </Label>
                <Input
                  id="profit-table-filter"
                  placeholder="Filter table by name or barcode…"
                  value={profitTableFilter}
                  onChange={(e) => setProfitTableFilter(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Showing {filteredProfitRows.length}
              {profitTableFilter.trim()
                ? ` of ${productProfitRows.length}`
                : ""}{" "}
              {filteredProfitRows.length === 1 ? "product" : "products"}
              {profitTableFilter.trim() ? " · matching filter" : ""}.
            </p>
            {productProfitRows.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No sales or damaged movements in this period.
              </p>
            ) : filteredProfitRows.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Nothing matches this filter — try another search.
              </p>
            ) : (
              <div className="mt-3 max-h-[min(420px,50vh)] overflow-auto rounded-lg border border-border">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead className="sticky top-0 z-[1] shadow-[0_1px_0_var(--border)]">
                    <tr className="border-b border-border bg-muted/95 backdrop-blur-sm dark:bg-muted/90">
                      <th className="px-3 py-2 font-medium">Product</th>
                      <th className="px-3 py-2 font-medium tabular-nums">Units</th>
                      <th className="px-3 py-2 font-medium tabular-nums">
                        Revenue
                      </th>
                      <th className="px-3 py-2 font-medium tabular-nums">
                        Gross profit
                      </th>
                      <th className="px-3 py-2 font-medium tabular-nums">
                        Damaged
                      </th>
                      <th className="px-3 py-2 font-medium tabular-nums">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfitRows.map((r) => (
                      <tr
                        key={r.productId}
                        className={cn(
                          "border-b border-border/80 last:border-0",
                          r.productId === selectedProductId &&
                            "bg-primary/8 dark:bg-primary/12",
                        )}
                      >
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="cursor-pointer text-left font-medium underline-offset-2 hover:underline"
                            onClick={() => setSelectedProductId(r.productId)}
                          >
                            {r.name}
                          </button>
                        </td>
                        <td className="px-3 py-2 tabular-nums">{r.unitsSold}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {formatMoney(r.revenue)}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {formatMoney(r.grossProfit)}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">
                          {r.damagedAtCost > 0
                            ? formatMoney(-r.damagedAtCost)
                            : "—"}
                        </td>
                        <td className="px-3 py-2 font-medium tabular-nums text-primary">
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

      <div className="grid gap-6 md:grid-cols-2">
        {periods.map((p) => (
          <Card key={p.label}>
            <CardHeader>
              <CardTitle className="text-base">{p.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-3xl font-semibold tabular-nums">
                  {formatMoney(p.revenue)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Revenue · {p.tx} transactions
                </p>
              </div>
              <div className="border-t border-border/80 pt-3 text-sm">
                <div className="flex justify-between gap-2 tabular-nums">
                  <span className="text-muted-foreground">
                    Gross profit (sales)
                  </span>
                  <span>{formatMoney(p.grossFromSales)}</span>
                </div>
                <div className="mt-2 flex justify-between gap-2 tabular-nums">
                  <span className="text-muted-foreground">
                    Damaged @ cost
                  </span>
                  <span className="text-destructive">
                    {p.damagedAtCost > 0
                      ? formatMoney(-p.damagedAtCost)
                      : formatMoney(p.damagedAtCost)}
                  </span>
                </div>
                <div className="mt-3 flex justify-between gap-2 border-t border-border/60 pt-3 font-semibold tabular-nums">
                  <span>Est. net profit</span>
                  <span className="text-primary">{formatMoney(p.netEstimate)}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Net = sales margin minus damaged units × buying price.
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
