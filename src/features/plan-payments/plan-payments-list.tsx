"use client";

import * as React from "react";
import { endOfDay, format, parseISO, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { CashCollection } from "@/lib/entities";
import {
  CASH_COLLECTION_SOURCE,
  PLAN_PAYMENTS_PAGE_SIZE,
} from "@/lib/constants";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney } from "@/lib/format-money";
import {
  collectionsInRange,
  planPaymentTypeLabel,
  planPaymentTypeLabelLong,
} from "@/lib/revenue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SourceFilter = "all" | "installment" | "pay_later";

function fileStamp() {
  return new Date().toISOString().slice(0, 10);
}

export function PlanPaymentsList({
  collections,
}: {
  collections: CashCollection[];
}) {
  const [sourceFilter, setSourceFilter] = React.useState<SourceFilter>("all");
  const [paymentsDate, setPaymentsDate] = React.useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const [page, setPage] = React.useState(0);

  const dateBounds = React.useMemo(() => {
    const d = parseISO(paymentsDate);
    if (Number.isNaN(d.getTime())) return null;
    return {
      start: startOfDay(d).getTime(),
      end: endOfDay(d).getTime(),
    };
  }, [paymentsDate]);

  const filtered = React.useMemo(() => {
    if (!dateBounds) return [];
    let rows = collectionsInRange(
      collections,
      dateBounds.start,
      dateBounds.end,
    );
    if (sourceFilter === CASH_COLLECTION_SOURCE.installment) {
      rows = rows.filter(
        (c) => c.sourceKind === CASH_COLLECTION_SOURCE.installment,
      );
    } else if (sourceFilter === CASH_COLLECTION_SOURCE.payLater) {
      rows = rows.filter(
        (c) => c.sourceKind === CASH_COLLECTION_SOURCE.payLater,
      );
    }
    return [...rows].sort((a, b) => b.paidAt - a.paidAt);
  }, [collections, dateBounds, sourceFilter]);

  const totalAmount = filtered.reduce((sum, c) => sum + c.amount, 0);
  const pageSize = PLAN_PAYMENTS_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageClamped = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(
    pageClamped * pageSize,
    pageClamped * pageSize + pageSize,
  );
  const hasPrev = pageClamped > 0;
  const hasNext = pageClamped < pageCount - 1;

  React.useEffect(() => {
    setPage(0);
  }, [paymentsDate, sourceFilter]);

  React.useEffect(() => {
    if (page !== pageClamped) setPage(pageClamped);
  }, [page, pageClamped]);

  function exportDay() {
    if (!dateBounds) return;
    const headers = [
      "Paid at (ISO)",
      "Type",
      "Customer",
      "Amount",
      "Note",
      "Plan ID",
    ];
    const rows = [...filtered]
      .sort((a, b) => a.paidAt - b.paidAt)
      .map((c) => [
        new Date(c.paidAt).toISOString(),
        planPaymentTypeLabelLong(c.sourceKind),
        c.customerName,
        formatMoney(c.amount),
        c.note ?? "",
        c.sourceId,
      ]);
    downloadCsv(
      `plan-payments-${paymentsDate}-${fileStamp()}.csv`,
      toCsv(headers, rows),
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="text-lg">Paid in installments & pay later</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Cash received from installment and pay-later payments, counted on the
            day each payment was recorded.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label htmlFor="plan-payments-date">Date</Label>
            <Input
              id="plan-payments-date"
              type="date"
              value={paymentsDate}
              onChange={(e) => setPaymentsDate(e.target.value)}
              className="h-11 w-full min-w-[11rem] cursor-pointer sm:w-auto"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer gap-2"
            onClick={() => exportDay()}
            disabled={filtered.length === 0}
          >
            <Download className="size-4" aria-hidden />
            Export day
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              [CASH_COLLECTION_SOURCE.installment, "Installments"],
              [CASH_COLLECTION_SOURCE.payLater, "Pay later"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={
                sourceFilter === key
                  ? "cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                  : "cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              }
              onClick={() => setSourceFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {!dateBounds ? (
          <p className="text-sm text-muted-foreground">Choose a valid date.</p>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-muted/25 p-4">
              <p className="text-sm font-medium">
                {format(parseISO(paymentsDate), "EEEE, MMM d, yyyy")}
              </p>
              <p className="mt-3 text-3xl font-semibold tabular-nums">
                {formatMoney(totalAmount)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {filtered.length}{" "}
                {filtered.length === 1 ? "payment" : "payments"} received
              </p>
            </div>

            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No installment or pay-later payments on this date.
              </p>
            ) : (
              <>
                <ul className="space-y-3">
                  {pageItems.map((payment) => (
                    <li
                      key={payment.id}
                      className="rounded-xl border border-border bg-muted/30 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {planPaymentTypeLabel(payment.sourceKind)}
                          </p>
                          <p className="font-medium">{payment.customerName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums">
                            {formatMoney(payment.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(payment.paidAt), "PPpp")}
                          </p>
                        </div>
                      </div>
                      {payment.note ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {payment.note}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>

                {filtered.length > pageSize ? (
                  <div className="flex flex-col gap-3 border-t border-border/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      {pageSize} per page · {filtered.length} total
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="cursor-pointer gap-1"
                        disabled={!hasPrev}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                      >
                        <ChevronLeft className="size-4" aria-hidden />
                        Previous
                      </Button>
                      <span className="min-w-[5rem] text-center text-sm tabular-nums text-muted-foreground">
                        Page {pageClamped + 1}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="cursor-pointer gap-1"
                        disabled={!hasNext}
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
        )}
      </CardContent>
    </Card>
  );
}
