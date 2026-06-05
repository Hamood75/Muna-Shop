"use client";

import * as React from "react";
import { format, parseISO, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product, Sale } from "@/lib/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format-money";
import { formatQuantityDisplay } from "@/lib/quantity";
import { EditSaleDialog } from "@/features/sales/edit-sale-dialog";

type DayGroup = {
  dateKey: string;
  label: string;
  sales: Sale[];
  total: number;
};

function groupSalesByDay(sales: Sale[], rangeMs: number | null): DayGroup[] {
  const now = Date.now();
  const byDay = new Map<string, Sale[]>();

  for (const sale of sales) {
    if (rangeMs != null && now - sale.createdAt > rangeMs) continue;
    const dateKey = format(startOfDay(new Date(sale.createdAt)), "yyyy-MM-dd");
    const list = byDay.get(dateKey) ?? [];
    list.push(sale);
    byDay.set(dateKey, list);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, daySales]) => {
      const sorted = [...daySales].sort((a, b) => b.createdAt - a.createdAt);
      const d = parseISO(dateKey);
      return {
        dateKey,
        label: Number.isNaN(d.getTime())
          ? dateKey
          : format(d, "EEEE, MMM d, yyyy"),
        sales: sorted,
        total: sorted.reduce((sum, s) => sum + s.totalAmount, 0),
      };
    });
}

export function SalesHistory({
  sales,
  products,
}: {
  sales: Sale[];
  products: Product[];
}) {
  const [filter, setFilter] = React.useState<"7d" | "30d" | "all">("7d");
  const [dayPage, setDayPage] = React.useState(0);
  const [editSale, setEditSale] = React.useState<Sale | null>(null);

  const rangeMs = React.useMemo(() => {
    if (filter === "7d") return 7 * 24 * 60 * 60 * 1000;
    if (filter === "30d") return 30 * 24 * 60 * 60 * 1000;
    return null;
  }, [filter]);

  const dayGroups = React.useMemo(
    () => groupSalesByDay(sales, rangeMs),
    [sales, rangeMs],
  );

  const dayPageCount = Math.max(1, dayGroups.length);
  const dayPageClamped = Math.min(dayPage, dayPageCount - 1);
  const activeDay = dayGroups[dayPageClamped] ?? null;
  const hasPrevDay = dayPageClamped > 0;
  const hasNextDay = dayPageClamped < dayGroups.length - 1;

  React.useEffect(() => {
    setDayPage(0);
  }, [filter]);

  React.useEffect(() => {
    if (dayPage !== dayPageClamped) {
      setDayPage(dayPageClamped);
    }
  }, [dayPage, dayPageClamped]);

  return (
    <Card>
      <EditSaleDialog
        sale={editSale}
        products={products}
        open={editSale != null}
        onOpenChange={(open) => {
          if (!open) setEditSale(null);
        }}
      />
      <CardHeader className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">Sales history</CardTitle>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["7d", "7 days"],
                ["30d", "30 days"],
                ["all", "All"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={
                  filter === k
                    ? "cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                    : "cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                }
                onClick={() => setFilter(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          One page per calendar day — use Previous and Next to move between days.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {dayGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sales in this range.</p>
        ) : activeDay ? (
          <>
            <div className="rounded-xl border border-border bg-gradient-to-br from-muted/40 to-muted/10 p-4">
              <p className="text-sm font-medium">{activeDay.label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {formatMoney(activeDay.total)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeDay.sales.length}{" "}
                {activeDay.sales.length === 1 ? "sale" : "sales"} this day
              </p>
            </div>

            <ul className="space-y-3">
              {activeDay.sales.map((sale) => (
                <li
                  key={sale.id}
                  className="rounded-xl border border-border bg-muted/30 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="text-sm font-semibold tabular-nums">
                      {formatMoney(sale.totalAmount)}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditSale(sale)}
                        className="min-h-9 cursor-pointer"
                      >
                        Edit
                      </Button>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(sale.createdAt), "p")}
                      </div>
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

            {dayGroups.length > 1 ? (
              <div className="flex flex-col gap-3 border-t border-border/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Day {dayPageClamped + 1} of {dayGroups.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer gap-1"
                    disabled={!hasPrevDay}
                    onClick={() => setDayPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                    Newer day
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer gap-1"
                    disabled={!hasNextDay}
                    onClick={() => setDayPage((p) => p + 1)}
                  >
                    Older day
                    <ChevronRight className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
