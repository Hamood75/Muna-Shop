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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Debt = CreditDebt;

export function CreditDebtsList({ debts }: { debts: Debt[] }) {
  const [filter, setFilter] = React.useState<"open" | "all">("open");

  const filtered = React.useMemo(() => {
    const sorted = [...debts].sort((a, b) => b.createdAt - a.createdAt);
    if (filter === "all") return sorted;
    return sorted.filter((d) => d.status === CREDIT_DEBT_STATUS.open);
  }, [debts, filter]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-lg">Customer balances</CardTitle>
        <div className="flex gap-2">
          {(
            [
              ["open", "Open"],
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
          <p className="text-sm text-muted-foreground">
            No records in this view.
          </p>
        ) : (
          <ul className="space-y-4">
            {filtered.map((debt) => (
              <DebtRow key={debt.id} debt={debt} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DebtRow({ debt }: { debt: Debt }) {
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
  const settled =
    debt.status === CREDIT_DEBT_STATUS.settled || remaining <= 0;

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
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-medium">{debt.customerName}</div>
        <div className="text-xs text-muted-foreground">
          {format(new Date(debt.createdAt), "PPp")}
        </div>
      </div>
      <div className="mt-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">
          {debt.product?.name ?? "Product"}
        </span>
        {" · "}× {debt.quantity}
        <span className="tabular-nums">
          {" "}
          @ {formatMoney(debt.unitPriceAtSale)}
        </span>
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
