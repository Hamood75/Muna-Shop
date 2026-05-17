"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import type { InstallmentPlan } from "@/lib/entities";
import {
  appendSyncHint,
  recordInstallmentPaymentClient,
} from "@/lib/write";
import { queryKeys } from "@/lib/query-keys";
import { INSTALLMENT_STATUS } from "@/lib/constants";
import { formatMoney } from "@/lib/format-money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Plan = InstallmentPlan;

export function InstallmentPlansList({ plans }: { plans: Plan[] }) {
  const [filter, setFilter] = React.useState<"active" | "all">("active");

  const filtered = React.useMemo(() => {
    const sorted = [...plans].sort((a, b) => b.createdAt - a.createdAt);
    if (filter === "all") return sorted;
    return sorted.filter((p) => p.status === INSTALLMENT_STATUS.active);
  }, [plans, filter]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-lg">Installment plans</CardTitle>
        <div className="flex gap-2">
          {(
            [
              ["active", "Active"],
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
            No plans in this view.
          </p>
        ) : (
          <ul className="space-y-4">
            {filtered.map((plan) => (
              <PlanRow key={plan.id} plan={plan} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PlanRow({ plan }: { plan: Plan }) {
  const [amount, setAmount] = React.useState("");
  const queryClient = useQueryClient();
  const payMut = useMutation({
    mutationFn: (payload: { planId: string; amount: number }) =>
      recordInstallmentPaymentClient(payload, plan),
    onSuccess: (res) => {
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(appendSyncHint("Payment recorded"));
        setAmount("");
        void queryClient.invalidateQueries({ queryKey: queryKeys.root });
      }
    },
  });

  const remaining = Math.max(0, plan.totalAmount - plan.paidSoFar);
  const isDone = plan.status === INSTALLMENT_STATUS.completed || remaining <= 0;

  function pay() {
    const n = Number.parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }
    payMut.mutate({ planId: plan.id, amount: n });
  }

  return (
    <li className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-medium">{plan.customerName}</div>
        <div className="text-xs text-muted-foreground">
          {format(new Date(plan.createdAt), "PPp")}
        </div>
      </div>
      <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
        {(plan.items ?? []).map((item) => (
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
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm tabular-nums">
        <span>
          Total <strong>{formatMoney(plan.totalAmount)}</strong>
        </span>
        <span>
          Paid <strong>{formatMoney(plan.paidSoFar)}</strong>
        </span>
        <span>
          Balance{" "}
          <strong className={isDone ? "text-emerald-600 dark:text-emerald-400" : ""}>
            {formatMoney(remaining)}
          </strong>
        </span>
      </div>
      {plan.notes ? (
        <p className="mt-2 text-xs text-muted-foreground">{plan.notes}</p>
      ) : null}
      {!isDone ? (
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
          Paid in full
        </p>
      )}
    </li>
  );
}
