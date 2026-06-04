import type { CashCollection } from "@/lib/entities";
import { CASH_COLLECTION_SOURCE } from "@/lib/constants";

type SaleLike = { createdAt: number; totalAmount: number };

export function planPaymentTypeLabel(sourceKind: string): string {
  if (sourceKind === CASH_COLLECTION_SOURCE.installment) return "Installment";
  if (sourceKind === CASH_COLLECTION_SOURCE.payLater) return "Pay later";
  return "Plan payment";
}

export function planPaymentTypeLabelLong(sourceKind: string): string {
  if (sourceKind === CASH_COLLECTION_SOURCE.installment) {
    return "Installment payment";
  }
  if (sourceKind === CASH_COLLECTION_SOURCE.payLater) {
    return "Pay-later payment";
  }
  return "Plan payment";
}

export function collectionsInRange(
  collections: CashCollection[],
  rangeStart: number,
  rangeEnd: number,
): CashCollection[] {
  return collections.filter(
    (c) => c.paidAt >= rangeStart && c.paidAt <= rangeEnd,
  );
}

export function salesInRange(
  sales: SaleLike[],
  rangeStart: number,
  rangeEnd: number,
): SaleLike[] {
  return sales.filter(
    (s) => s.createdAt >= rangeStart && s.createdAt <= rangeEnd,
  );
}

/** Gross cash in: POS sales plus installment / pay-later payments on their paid date. */
export function grossRevenueInRange(
  sales: SaleLike[],
  collections: CashCollection[],
  rangeStart: number,
  rangeEnd: number,
): number {
  let total = 0;
  for (const s of sales) {
    if (s.createdAt >= rangeStart && s.createdAt <= rangeEnd) {
      total += s.totalAmount;
    }
  }
  for (const c of collections) {
    if (c.paidAt >= rangeStart && c.paidAt <= rangeEnd) {
      total += c.amount;
    }
  }
  return total;
}

export function cashTransactionCountInRange(
  sales: SaleLike[],
  collections: CashCollection[],
  rangeStart: number,
  rangeEnd: number,
): number {
  return (
    salesInRange(sales, rangeStart, rangeEnd).length +
    collectionsInRange(collections, rangeStart, rangeEnd).length
  );
}
