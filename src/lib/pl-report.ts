import type {
  CashCollection,
  CreditDebt,
  InstallmentPlan,
  Product,
  Sale,
  SaleItem,
  StockMovement,
} from "@/lib/entities";
import { CASH_COLLECTION_SOURCE } from "@/lib/constants";

export type ProductPL = Product;

export type SaleItemPL = SaleItem & {
  product?: Product | null;
};

export type SalePL = Sale & {
  items?: SaleItemPL[];
};

export type StockMovementPL = StockMovement & {
  product?: Product | null;
};

export type PlanLinePL = {
  productId?: string;
  quantity: number;
  unitPrice: number;
  product?: ProductPL | null;
};

export type InstallmentPlanPL = Pick<InstallmentPlan, "id" | "totalAmount"> & {
  items?: PlanLinePL[];
};

export type CreditDebtPL = Pick<CreditDebt, "id" | "totalOwed"> & {
  items?: PlanLinePL[];
};

export type PlanProfitContext = {
  cashCollections: CashCollection[];
  installmentPlans: InstallmentPlanPL[];
  creditDebts: CreditDebtPL[];
};

/** Margin + damaged exposure for one SKU in a date window. */
export type ProductProfitRow = {
  productId: string;
  name: string;
  barcode: string;
  unitsSold: number;
  revenue: number;
  grossProfit: number;
  damagedUnits: number;
  damagedAtCost: number;
  netContribution: number;
};

function resolveSaleLineProduct(
  item: SaleItemPL,
  catalog: ProductPL[],
): ProductPL | undefined {
  const pid = item.productId ?? item.product?.id;
  return (
    item.product ??
    (pid ? catalog.find((x) => x.id === pid) : undefined)
  );
}

function resolveMovementProduct(
  m: StockMovementPL,
  catalog: ProductPL[],
): ProductPL | undefined {
  const pid = m.product?.id;
  return m.product ?? (pid ? catalog.find((x) => x.id === pid) : undefined);
}

type ProfitAgg = {
  unitsSold: number;
  revenue: number;
  grossProfit: number;
  damagedUnits: number;
  damagedAtCost: number;
};

function aggregateProfitByProductId(
  sales: SalePL[],
  movements: StockMovementPL[],
  catalog: ProductPL[],
  rangeStart: number,
  rangeEnd: number,
): Map<string, ProfitAgg> {
  const map = new Map<string, ProfitAgg>();
  const touch = (id: string): ProfitAgg => {
    let a = map.get(id);
    if (!a) {
      a = {
        unitsSold: 0,
        revenue: 0,
        grossProfit: 0,
        damagedUnits: 0,
        damagedAtCost: 0,
      };
      map.set(id, a);
    }
    return a;
  };

  for (const s of sales) {
    if (s.createdAt < rangeStart || s.createdAt > rangeEnd) continue;
    for (const item of s.items ?? []) {
      const p = resolveSaleLineProduct(item, catalog);
      if (!p) continue;
      const a = touch(p.id);
      a.unitsSold += item.quantity;
      a.revenue += item.lineTotal;
      a.grossProfit += item.quantity * (item.unitPrice - p.buyingPrice);
    }
  }

  for (const m of movements) {
    if (m.kind !== "damaged") continue;
    if (m.createdAt < rangeStart || m.createdAt > rangeEnd) continue;
    const p = resolveMovementProduct(m, catalog);
    if (!p) continue;
    const units = Math.abs(m.quantityDelta);
    const a = touch(p.id);
    a.damagedUnits += units;
    a.damagedAtCost += units * p.buyingPrice;
  }

  return map;
}

function profitRowFromAgg(
  productId: string,
  agg: ProfitAgg,
  catalog: ProductPL[],
): ProductProfitRow {
  const meta = catalog.find((x) => x.id === productId);
  return {
    productId,
    name: meta?.name ?? "Unknown",
    barcode: meta?.barcode?.trim() ?? "",
    unitsSold: agg.unitsSold,
    revenue: agg.revenue,
    grossProfit: agg.grossProfit,
    damagedUnits: agg.damagedUnits,
    damagedAtCost: agg.damagedAtCost,
    netContribution: agg.grossProfit - agg.damagedAtCost,
  };
}

/** Rows for every SKU that had sales or damaged movements in the window, sorted by net contribution. */
export function allProductsProfitInRange(
  sales: SalePL[],
  movements: StockMovementPL[],
  catalog: ProductPL[],
  rangeStart: number,
  rangeEnd: number,
): ProductProfitRow[] {
  const map = aggregateProfitByProductId(
    sales,
    movements,
    catalog,
    rangeStart,
    rangeEnd,
  );
  return [...map.entries()]
    .map(([id, agg]) => profitRowFromAgg(id, agg, catalog))
    .filter((row) => row.unitsSold > 0 || row.damagedUnits > 0)
    .sort((a, b) => b.netContribution - a.netContribution);
}

/** Same metrics for one product (zeros when no activity in range). */
export function profitForProductInRange(
  sales: SalePL[],
  movements: StockMovementPL[],
  catalog: ProductPL[],
  productId: string,
  rangeStart: number,
  rangeEnd: number,
): ProductProfitRow {
  const map = aggregateProfitByProductId(
    sales,
    movements,
    catalog,
    rangeStart,
    rangeEnd,
  );
  const agg = map.get(productId);
  if (agg) return profitRowFromAgg(productId, agg, catalog);
  const meta = catalog.find((x) => x.id === productId);
  return {
    productId,
    name: meta?.name ?? "Unknown",
    barcode: meta?.barcode?.trim() ?? "",
    unitsSold: 0,
    revenue: 0,
    grossProfit: 0,
    damagedUnits: 0,
    damagedAtCost: 0,
    netContribution: 0,
  };
}

/** Gross margin from sales only: Σ qty × (sell − buy). Uses linked product or catalog fallback. */
export function grossProfitFromSalesInRange(
  sales: SalePL[],
  products: ProductPL[],
  rangeStart: number,
  rangeEnd: number,
): number {
  let total = 0;
  for (const s of sales) {
    if (s.createdAt < rangeStart || s.createdAt > rangeEnd) continue;
    for (const item of s.items ?? []) {
      const pid = item.product?.id;
      const p =
        item.product ??
        (pid ? products.find((x) => x.id === pid) : undefined);
      if (!p) continue;
      total += (p.sellingPrice - p.buyingPrice) * item.quantity;
    }
  }
  return total;
}

/** COGS written off for damaged stock: Σ units × current buying price on linked product. */
export function damagedInventoryCostInRange(
  movements: StockMovementPL[],
  products: ProductPL[],
  rangeStart: number,
  rangeEnd: number,
): number {
  let loss = 0;
  for (const m of movements) {
    if (m.kind !== "damaged") continue;
    if (m.createdAt < rangeStart || m.createdAt > rangeEnd) continue;
    const units = Math.abs(m.quantityDelta);
    const pid = m.product?.id;
    const p =
      m.product ??
      (pid ? products.find((x) => x.id === pid) : undefined);
    const unitCost = p?.buyingPrice ?? 0;
    loss += units * unitCost;
  }
  return loss;
}

function planLinesGrossProfit(
  lines: PlanLinePL[],
  catalog: ProductPL[],
): number {
  let total = 0;
  for (const item of lines) {
    const p =
      item.product ??
      (item.productId ? catalog.find((x) => x.id === item.productId) : undefined);
    if (!p) continue;
    total += item.quantity * (item.unitPrice - p.buyingPrice);
  }
  return total;
}

/** Margin recognized on payment date: payment share × plan line gross profit. */
export function planPaymentGrossProfitInRange(
  collections: CashCollection[],
  installmentPlans: InstallmentPlanPL[],
  creditDebts: CreditDebtPL[],
  products: ProductPL[],
  rangeStart: number,
  rangeEnd: number,
): number {
  const installmentById = new Map(
    installmentPlans.map((p) => [p.id, p] as const),
  );
  const debtById = new Map(creditDebts.map((d) => [d.id, d] as const));

  let total = 0;
  for (const c of collections) {
    if (c.paidAt < rangeStart || c.paidAt > rangeEnd) continue;

    if (c.sourceKind === CASH_COLLECTION_SOURCE.installment) {
      const plan = installmentById.get(c.sourceId);
      if (!plan || plan.totalAmount <= 0) continue;
      const planProfit = planLinesGrossProfit(plan.items ?? [], products);
      total += (c.amount / plan.totalAmount) * planProfit;
    } else if (c.sourceKind === CASH_COLLECTION_SOURCE.payLater) {
      const debt = debtById.get(c.sourceId);
      if (!debt || debt.totalOwed <= 0) continue;
      const planProfit = planLinesGrossProfit(debt.items ?? [], products);
      total += (c.amount / debt.totalOwed) * planProfit;
    }
  }
  return total;
}

/** Gross profit from sales minus damaged inventory at cost (same window). */
export function estimatedNetProfitInRange(
  sales: SalePL[],
  movements: StockMovementPL[],
  products: ProductPL[],
  rangeStart: number,
  rangeEnd: number,
  planContext?: PlanProfitContext,
): {
  grossFromSales: number;
  damagedAtCost: number;
  netEstimate: number;
} {
  const grossFromPosSales = grossProfitFromSalesInRange(
    sales,
    products,
    rangeStart,
    rangeEnd,
  );
  const grossFromPlanPayments = planContext
    ? planPaymentGrossProfitInRange(
        planContext.cashCollections,
        planContext.installmentPlans,
        planContext.creditDebts,
        products,
        rangeStart,
        rangeEnd,
      )
    : 0;
  const grossFromSales = grossFromPosSales + grossFromPlanPayments;
  const damagedAtCost = damagedInventoryCostInRange(
    movements,
    products,
    rangeStart,
    rangeEnd,
  );
  return {
    grossFromSales,
    damagedAtCost,
    netEstimate: grossFromSales - damagedAtCost,
  };
}
