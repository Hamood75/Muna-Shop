import type { CashCollection } from "@/lib/entities";
import type {
  CreditDebtPL,
  InstallmentPlanPL,
  ProductPL,
  SalePL,
  StockMovementPL,
} from "@/lib/pl-report";

export type PeriodMetrics = {
  label: string;
  revenue: number;
  tx: number;
  grossFromSales: number;
  damagedAtCost: number;
  netEstimate: number;
};

export type DayCashEntry =
  | { kind: "sale"; at: number; id: string; amount: number; sale: SalePL }
  | {
      kind: "collection";
      at: number;
      id: string;
      amount: number;
      collection: CashCollection;
    };

export type ReportsData = {
  sales: SalePL[];
  products: ProductPL[];
  stockMovements: StockMovementPL[];
  cashCollections: CashCollection[];
  installmentPlans: InstallmentPlanPL[];
  creditDebts: CreditDebtPL[];
};

export const selectLikeClass =
  "flex h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export function fileStamp() {
  return new Date().toISOString().slice(0, 10);
}
