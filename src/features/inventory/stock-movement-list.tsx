"use client";

import type { ReactNode } from "react";
import { format } from "date-fns";
import type { InstaQLEntity } from "@instantdb/react";
import type { AppSchema } from "@/instant.schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Movement = InstaQLEntity<AppSchema, "stockMovements"> & {
  product?: InstaQLEntity<AppSchema, "products"> | null;
};

const MOVEMENT_KIND_LABEL: Record<string, string> = {
  sale: "Sale",
  restock: "Restock",
  adjustment: "Adjustment",
  damaged: "Damaged",
};

function formatMovementKind(kind: string) {
  return MOVEMENT_KIND_LABEL[kind] ?? kind;
}

export function StockMovementList({
  movements,
  paginationFooter,
}: {
  movements: Movement[];
  paginationFooter?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent movements</CardTitle>
      </CardHeader>
      <CardContent>
        {movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No movements logged.</p>
        ) : (
          <ul className="space-y-2">
            {movements.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium">
                    {m.product?.name ?? "Product"}
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    {formatMovementKind(m.kind)}
                  </span>
                  {m.note ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      · {m.note}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 tabular-nums">
                  <span
                    className={
                      m.quantityDelta >= 0 ? "text-teal-600 dark:text-teal-400" : "text-destructive"
                    }
                  >
                    {m.quantityDelta >= 0 ? "+" : ""}
                    {m.quantityDelta}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(m.createdAt), "MMM d, HH:mm")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {paginationFooter ? (
          <div className="mt-4 border-t border-border/80 pt-4">{paginationFooter}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
