"use client";

import * as React from "react";
import { format } from "date-fns";
import type { Sale } from "@/lib/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format-money";

export function SalesHistory({ sales }: { sales: Sale[] }) {
  const [filter, setFilter] = React.useState<"7d" | "30d" | "all">("7d");

  const filtered = React.useMemo(() => {
    const now = Date.now();
    const ms =
      filter === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : filter === "30d"
          ? 30 * 24 * 60 * 60 * 1000
          : null;
    const sorted = [...sales].sort((a, b) => b.createdAt - a.createdAt);
    if (!ms) return sorted;
    return sorted.filter((s) => now - s.createdAt <= ms);
  }, [sales, filter]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-lg">Sales history</CardTitle>
        <div className="flex gap-2">
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
                  ? "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground cursor-pointer"
                  : "rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted cursor-pointer"
              }
              onClick={() => setFilter(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sales in this range.</p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((sale) => (
              <li
                key={sale.id}
                className="rounded-xl border border-border bg-muted/30 p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-sm font-semibold tabular-nums">
                    {formatMoney(sale.totalAmount)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(sale.createdAt), "PPpp")}
                  </div>
                </div>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {(sale.items ?? []).map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between gap-2 tabular-nums"
                    >
                      <span>
                        {item.product?.name ?? "Product"} × {item.quantity}
                      </span>
                      <span>{formatMoney(item.lineTotal)}</span>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
