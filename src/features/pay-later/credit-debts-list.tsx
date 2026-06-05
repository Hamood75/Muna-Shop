"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import type { CreditDebt } from "@/lib/entities";
import {
  appendSyncHint,
  recordCreditPaymentClient,
} from "@/lib/write";
import { queryKeys } from "@/lib/query-keys";
import { CREDIT_DEBT_STATUS } from "@/lib/constants";
import { formatMoney } from "@/lib/format-money";
import { formatQuantityDisplay } from "@/lib/quantity";
import type { Product } from "@/lib/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EditCreditDebtDialog } from "@/features/pay-later/edit-credit-debt-dialog";

type Debt = CreditDebt;
type DebtFilter = "open" | "paid" | "all";

function isDebtSettled(debt: Debt): boolean {
  const remaining = Math.max(0, debt.totalOwed - debt.paidSoFar);
  return debt.status === CREDIT_DEBT_STATUS.settled || remaining <= 0;
}

export function CreditDebtsList({
  debts,
  products,
}: {
  debts: Debt[];
  products: Product[];
}) {
  const [filter, setFilter] = React.useState<DebtFilter>("open");
  const [search, setSearch] = React.useState("");
  const [editDebt, setEditDebt] = React.useState<Debt | null>(null);

  const filtered = React.useMemo(() => {
    const sorted = [...debts].sort((a, b) => b.createdAt - a.createdAt);
    const byStatus =
      filter === "all"
        ? sorted
        : filter === "paid"
          ? sorted.filter(isDebtSettled)
          : sorted.filter((d) => !isDebtSettled(d));

    const q = search.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter((d) => d.customerName.toLowerCase().includes(q));
  }, [debts, filter, search]);

  return (
    <Card>
      <EditCreditDebtDialog
        debt={editDebt}
        products={products}
        open={editDebt != null}
        onOpenChange={(open) => {
          if (!open) setEditDebt(null);
        }}
      />
      <CardHeader className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">Customer balances</CardTitle>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["open", "Open"],
                ["paid", "Paid"],
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
        <div className="grid gap-2 sm:max-w-md">
          <Label htmlFor="credit-debt-search">Search customer</Label>
          <Input
            id="credit-debt-search"
            placeholder="Type a customer name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {search.trim()
              ? "No customers match this search in the selected filter."
              : "No records in this view."}
          </p>
        ) : (
          <ul className="space-y-4">
            {filtered.map((debt) => (
              <DebtRow
                key={debt.id}
                debt={debt}
                onEdit={() => setEditDebt(debt)}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DebtRow({
  debt,
  onEdit,
}: {
  debt: Debt;
  onEdit: () => void;
}) {
  const [amount, setAmount] = React.useState("");
  const queryClient = useQueryClient();
  const payMut = useMutation({
    mutationFn: (payload: { debtId: string; amount: number }) =>
      recordCreditPaymentClient(payload, debt),
    onSuccess: (res) => {
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(appendSyncHint("Payment recorded"));
        setAmount("");
        void queryClient.invalidateQueries({ queryKey: queryKeys.root });
      }
    },
  });

  const remaining = Math.max(0, debt.totalOwed - debt.paidSoFar);
  const settled = isDebtSettled(debt);

  function pay() {
    const n = Number.parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }
    payMut.mutate({ debtId: debt.id, amount: n });
  }

  return (
    <li className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="font-medium">{debt.customerName}</div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9 cursor-pointer"
            onClick={onEdit}
          >
            Edit
          </Button>
          <div className="text-xs text-muted-foreground">
            {format(new Date(debt.createdAt), "PPp")}
          </div>
        </div>
      </div>
      <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
        {(debt.items ?? []).length === 0 ? (
          <p>No line items recorded.</p>
        ) : (
          (debt.items ?? []).map((item) => (
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
          ))
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm tabular-nums">
        <span>
          Owed <strong>{formatMoney(debt.totalOwed)}</strong>
        </span>
        <span>
          Paid <strong>{formatMoney(debt.paidSoFar)}</strong>
        </span>
        <span>
          Balance{" "}
          <strong
            className={
              settled ? "text-emerald-600 dark:text-emerald-400" : ""
            }
          >
            {formatMoney(remaining)}
          </strong>
        </span>
      </div>
      {debt.notes ? (
        <p className="mt-2 text-xs text-muted-foreground">{debt.notes}</p>
      ) : null}
      {!settled ? (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              Record payment
            </span>
            <Input
              className="w-36 tabular-nums"
              inputMode="decimal"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <Button
            type="button"
            disabled={payMut.isPending}
            onClick={() => pay()}
          >
            {payMut.isPending ? "Saving…" : "Apply"}
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          Settled
        </p>
      )}
    </li>
  );
}
