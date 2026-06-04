import {
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import type { CashCollection } from "@/lib/entities";

export type RevenueGranularity = "day" | "month" | "year";

export type RevenueBucket = {
  key: string;
  label: string;
  shortLabel: string;
  start: number;
  end: number;
  salesAmount: number;
  planPaymentsAmount: number;
  total: number;
};

type SaleLike = { createdAt: number; totalAmount: number };

const DAY_BUCKETS = 30;
const MONTH_BUCKETS = 12;
const YEAR_BUCKETS = 5;

function sumSalesInRange(
  sales: SaleLike[],
  start: number,
  end: number,
): number {
  let total = 0;
  for (const s of sales) {
    if (s.createdAt >= start && s.createdAt <= end) total += s.totalAmount;
  }
  return total;
}

function sumPlanPaymentsInRange(
  collections: CashCollection[],
  start: number,
  end: number,
): number {
  let total = 0;
  for (const c of collections) {
    if (c.paidAt >= start && c.paidAt <= end) total += c.amount;
  }
  return total;
}

export function buildRevenueSeries(
  sales: SaleLike[],
  collections: CashCollection[],
  granularity: RevenueGranularity,
  now = new Date(),
): RevenueBucket[] {
  const buckets: RevenueBucket[] = [];

  if (granularity === "day") {
    const anchor = startOfDay(now);
    for (let i = DAY_BUCKETS - 1; i >= 0; i -= 1) {
      const dayStart = startOfDay(subDays(anchor, i)).getTime();
      const dayEnd = endOfDay(subDays(anchor, i)).getTime();
      const d = new Date(dayStart);
      buckets.push({
        key: format(d, "yyyy-MM-dd"),
        label: format(d, "EEE, MMM d"),
        shortLabel: format(d, "d MMM"),
        start: dayStart,
        end: dayEnd,
        salesAmount: sumSalesInRange(sales, dayStart, dayEnd),
        planPaymentsAmount: sumPlanPaymentsInRange(
          collections,
          dayStart,
          dayEnd,
        ),
        total: 0,
      });
    }
  } else if (granularity === "month") {
    const anchor = startOfMonth(now);
    for (let i = MONTH_BUCKETS - 1; i >= 0; i -= 1) {
      const monthStart = startOfMonth(subMonths(anchor, i)).getTime();
      const monthEnd = endOfMonth(subMonths(anchor, i)).getTime();
      const d = new Date(monthStart);
      buckets.push({
        key: format(d, "yyyy-MM"),
        label: format(d, "MMMM yyyy"),
        shortLabel: format(d, "MMM yy"),
        start: monthStart,
        end: monthEnd,
        salesAmount: sumSalesInRange(sales, monthStart, monthEnd),
        planPaymentsAmount: sumPlanPaymentsInRange(
          collections,
          monthStart,
          monthEnd,
        ),
        total: 0,
      });
    }
  } else {
    const anchor = startOfYear(now);
    for (let i = YEAR_BUCKETS - 1; i >= 0; i -= 1) {
      const yearStart = startOfYear(subYears(anchor, i)).getTime();
      const yearEnd = endOfYear(subYears(anchor, i)).getTime();
      const d = new Date(yearStart);
      buckets.push({
        key: format(d, "yyyy"),
        label: format(d, "yyyy"),
        shortLabel: format(d, "yy"),
        start: yearStart,
        end: yearEnd,
        salesAmount: sumSalesInRange(sales, yearStart, yearEnd),
        planPaymentsAmount: sumPlanPaymentsInRange(
          collections,
          yearStart,
          yearEnd,
        ),
        total: 0,
      });
    }
  }

  for (const b of buckets) {
    b.total = b.salesAmount + b.planPaymentsAmount;
  }

  return buckets;
}

export function revenueSeriesCaption(granularity: RevenueGranularity): string {
  if (granularity === "day") return `Last ${DAY_BUCKETS} days`;
  if (granularity === "month") return `Last ${MONTH_BUCKETS} months`;
  return `Last ${YEAR_BUCKETS} years`;
}

export function formatChartAxisMoney(amount: number): string {
  const n = Math.abs(amount);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}
