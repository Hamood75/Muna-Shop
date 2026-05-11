import { id, type TransactionChunk } from "@instantdb/core";
import type { InstaQLEntity } from "@instantdb/react";
import { z } from "zod";
import type { AppSchema } from "@/instant.schema";
import { db } from "@/lib/db";
import {
  CREDIT_DEBT_STATUS,
  INSTALLMENT_STATUS,
} from "@/lib/constants";
import { instantActionErrorMessage } from "@/lib/instant-errors";
import {
  productCreateSchema,
  productUpdateSchema,
  recordSaleSchema,
  stockAdjustSchema,
} from "@/lib/validations/inventory";
import {
  createCreditDebtSchema,
  createInstallmentPlanSchema,
  recordCreditPaymentSchema,
  recordInstallmentPaymentSchema,
} from "@/lib/validations/credit";

export type ClientTransactResult<T = void> =
  | { ok: true; data?: T; syncStatus: "synced" | "enqueued" }
  | { ok: false; error: string };

export function appendSyncHint(
  message: string,
  syncStatus: "synced" | "enqueued",
): string {
  return syncStatus === "enqueued"
    ? `${message} Queued; will sync when you are back online.`
    : message;
}

type ProductSnapshot = Pick<
  InstaQLEntity<AppSchema, "products">,
  "id" | "name" | "sellingPrice" | "stockQuantity"
>;

function zodFirstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

/** Instant usually settles immediately when offline; this avoids hung buttons if the SDK promise never resolves. */
const DEGRADED_TRANSACT_FALLBACK_MS = 3500;

/** Lie-fi / half-open sockets: never spin "Saving..." forever. */
const ONLINE_TRANSACT_TIMEOUT_MS = 25_000;

function instantRealtimeDegraded(): boolean {
  try {
    const status = db.core._reactor.status as string;
    return status === "closed" || status === "errored";
  } catch {
    return false;
  }
}

async function runTransact(
  chunks: TransactionChunk<any, any>[],
): Promise<ClientTransactResult> {
  const tx = db.transact(chunks);

  const degraded =
    (typeof navigator !== "undefined" && !navigator.onLine) ||
    instantRealtimeDegraded();

  try {
    if (degraded) {
      const { status } = await Promise.race([
        tx,
        new Promise<{ status: "enqueued" }>((resolve) =>
          setTimeout(
            () => resolve({ status: "enqueued" }),
            DEGRADED_TRANSACT_FALLBACK_MS,
          ),
        ),
      ]);
      return { ok: true, syncStatus: status };
    }

    const { status } = await Promise.race([
      tx,
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "Save timed out. Check your connection and try again.",
              ),
            ),
          ONLINE_TRANSACT_TIMEOUT_MS,
        ),
      ),
    ]);
    return { ok: true, syncStatus: status };
  } catch (e) {
    return { ok: false, error: instantActionErrorMessage(e) };
  } finally {
    void tx.catch(() => undefined);
  }
}

export async function recordSaleClient(
  userId: string | undefined,
  input: unknown,
  products: ProductSnapshot[],
): Promise<ClientTransactResult> {
  if (!userId) {
    return { ok: false, error: "Sign in required" };
  }

  const parsed = recordSaleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: zodFirstIssue(parsed.error) };
  }
  const data = parsed.data;

  const byId = new Map(products.map((p) => [p.id, p]));
  const running = new Map<string, number>();

  for (const pid of new Set(data.items.map((i) => i.productId))) {
    const p = byId.get(pid);
    if (!p) {
      return { ok: false, error: `Unknown product: ${pid}` };
    }
    running.set(pid, p.stockQuantity);
  }

  let totalAmount = 0;
  const lineMeta: {
    productId: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    nextStock: number;
  }[] = [];

  for (const line of data.items) {
    const p = byId.get(line.productId)!;
    const stock = running.get(line.productId)!;
    const unitPrice = p.sellingPrice;
    const lineTotal = unitPrice * line.quantity;
    if (stock < line.quantity) {
      return {
        ok: false,
        error: `Insufficient stock for "${p.name}"`,
      };
    }
    totalAmount += lineTotal;
    const nextStock = stock - line.quantity;
    running.set(line.productId, nextStock);
    lineMeta.push({
      productId: line.productId,
      quantity: line.quantity,
      unitPrice,
      lineTotal,
      nextStock,
    });
  }

  const saleId = id();
  const chunks: TransactionChunk<any, any>[] = [
    db.tx.sales[saleId].update({
      totalAmount,
      createdAt: Date.now(),
      note: data.note?.trim() || undefined,
    }),
    db.tx.sales[saleId].link({ creator: userId }),
  ];

  for (const line of lineMeta) {
    const saleItemId = id();
    chunks.push(
      db.tx.saleItems[saleItemId].update({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      }),
      db.tx.saleItems[saleItemId].link({ sale: saleId }),
      db.tx.saleItems[saleItemId].link({ product: line.productId }),
      db.tx.products[line.productId].update({
        stockQuantity: line.nextStock,
      }),
    );

    const movId = id();
    chunks.push(
      db.tx.stockMovements[movId].update({
        kind: "sale",
        quantityDelta: -line.quantity,
        createdAt: Date.now(),
        note: "Sale",
        relatedSaleId: saleId,
      }),
      db.tx.stockMovements[movId].link({ product: line.productId }),
    );
  }

  return runTransact(chunks);
}

export async function adjustStockClient(
  input: unknown,
  product: ProductSnapshot,
): Promise<ClientTransactResult> {
  const parsed = stockAdjustSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: zodFirstIssue(parsed.error) };
  }
  const data = parsed.data;

  if (data.productId !== product.id) {
    return { ok: false, error: "Product mismatch" };
  }

  const next = product.stockQuantity + data.delta;
  if (next < 0) {
    return { ok: false, error: "Stock cannot go negative" };
  }

  const movId = id();
  return runTransact([
    db.tx.products[data.productId].update({ stockQuantity: next }),
    db.tx.stockMovements[movId].update({
      kind: data.kind,
      quantityDelta: data.delta,
      note: data.note?.trim() || undefined,
      createdAt: Date.now(),
    }),
    db.tx.stockMovements[movId].link({ product: data.productId }),
  ]);
}

export async function createProductClient(
  input: unknown,
): Promise<ClientTransactResult<{ id: string }>> {
  const parsed = productCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: zodFirstIssue(parsed.error) };
  }
  const data = parsed.data;
  const pid = id();

  const res = await runTransact([
    db.tx.products[pid].update({
      name: data.name.trim(),
      barcode: data.barcode?.trim() || undefined,
      buyingPrice: data.buyingPrice,
      sellingPrice: data.sellingPrice,
      stockQuantity: data.stockQuantity,
      createdAt: Date.now(),
    }),
  ]);

  if (!res.ok) return res;
  return { ok: true, data: { id: pid }, syncStatus: res.syncStatus };
}

export async function updateProductClient(
  input: unknown,
): Promise<ClientTransactResult> {
  const parsed = productUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: zodFirstIssue(parsed.error) };
  }
  const row = parsed.data;
  const { id: productId, ...rest } = row;

  const payload: Record<string, unknown> = {};
  if (rest.name !== undefined) payload.name = rest.name.trim();
  if (rest.barcode !== undefined) {
    payload.barcode = rest.barcode.trim() || undefined;
  }
  if (rest.buyingPrice !== undefined) payload.buyingPrice = rest.buyingPrice;
  if (rest.sellingPrice !== undefined) {
    payload.sellingPrice = rest.sellingPrice;
  }
  if (rest.stockQuantity !== undefined) {
    payload.stockQuantity = rest.stockQuantity;
  }

  return runTransact([db.tx.products[productId].update(payload)]);
}

export async function deleteProductClient(
  productId: string,
): Promise<ClientTransactResult> {
  if (!productId.trim()) {
    return { ok: false, error: "Missing product id" };
  }
  return runTransact([db.tx.products[productId].delete()]);
}

export async function createInstallmentPlanClient(
  userId: string | undefined,
  input: unknown,
  products: ProductSnapshot[],
): Promise<ClientTransactResult<{ id: string }>> {
  if (!userId) {
    return { ok: false, error: "Sign in required" };
  }

  const parsed = createInstallmentPlanSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: zodFirstIssue(parsed.error) };
  }
  const data = parsed.data;

  const byId = new Map(products.map((p) => [p.id, p]));
  const running = new Map<string, number>();

  for (const pid of new Set(data.items.map((i) => i.productId))) {
    const p = byId.get(pid);
    if (!p) {
      return { ok: false, error: `Unknown product: ${pid}` };
    }
    running.set(pid, p.stockQuantity);
  }

  let totalAmount = 0;
  const lineMeta: {
    productId: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    nextStock: number;
  }[] = [];

  for (const line of data.items) {
    const p = byId.get(line.productId)!;
    const stock = running.get(line.productId)!;
    const unitPrice = p.sellingPrice;
    const lineTotal = unitPrice * line.quantity;
    if (stock < line.quantity) {
      return {
        ok: false,
        error: `Insufficient stock for "${p.name}"`,
      };
    }
    totalAmount += lineTotal;
    const nextStock = stock - line.quantity;
    running.set(line.productId, nextStock);
    lineMeta.push({
      productId: line.productId,
      quantity: line.quantity,
      unitPrice,
      lineTotal,
      nextStock,
    });
  }

  const initial = Math.min(data.initialPayment ?? 0, totalAmount);
  const planId = id();

  const chunks: TransactionChunk<any, any>[] = [
    db.tx.installmentPlans[planId].update({
      customerName: data.customerName.trim(),
      totalAmount,
      paidSoFar: initial,
      notes: data.notes?.trim() || undefined,
      createdAt: Date.now(),
      status:
        initial >= totalAmount
          ? INSTALLMENT_STATUS.completed
          : INSTALLMENT_STATUS.active,
    }),
    db.tx.installmentPlans[planId].link({ creator: userId }),
  ];

  for (const line of lineMeta) {
    const itemId = id();
    chunks.push(
      db.tx.installmentItems[itemId].update({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      }),
      db.tx.installmentItems[itemId].link({ plan: planId }),
      db.tx.installmentItems[itemId].link({ product: line.productId }),
      db.tx.products[line.productId].update({
        stockQuantity: line.nextStock,
      }),
    );

    const movId = id();
    chunks.push(
      db.tx.stockMovements[movId].update({
        kind: "installment",
        quantityDelta: -line.quantity,
        createdAt: Date.now(),
        note: `Installment · ${data.customerName.trim()}`,
        relatedSaleId: planId,
      }),
      db.tx.stockMovements[movId].link({ product: line.productId }),
    );
  }

  const res = await runTransact(chunks);
  if (!res.ok) return res;
  return { ok: true, data: { id: planId }, syncStatus: res.syncStatus };
}

export async function recordInstallmentPaymentClient(
  input: unknown,
  plan: {
    id: string;
    totalAmount: number;
    paidSoFar: number;
    status: string;
  },
): Promise<ClientTransactResult> {
  const parsed = recordInstallmentPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: zodFirstIssue(parsed.error) };
  }
  const data = parsed.data;

  if (data.planId !== plan.id) {
    return { ok: false, error: "Plan mismatch" };
  }
  if (plan.status === INSTALLMENT_STATUS.completed) {
    return { ok: false, error: "This plan is already paid in full" };
  }

  const remaining = plan.totalAmount - plan.paidSoFar;
  if (remaining <= 0) {
    return { ok: false, error: "Nothing left to pay" };
  }

  const payment = Math.min(data.amount, remaining);
  const nextPaid = plan.paidSoFar + payment;
  const completed = nextPaid >= plan.totalAmount;

  return runTransact([
    db.tx.installmentPlans[data.planId].update({
      paidSoFar: nextPaid,
      status: completed
        ? INSTALLMENT_STATUS.completed
        : INSTALLMENT_STATUS.active,
    }),
  ]);
}

export async function createCreditDebtClient(
  userId: string | undefined,
  input: unknown,
  product: ProductSnapshot,
): Promise<ClientTransactResult<{ id: string }>> {
  if (!userId) {
    return { ok: false, error: "Sign in required" };
  }

  const parsed = createCreditDebtSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: zodFirstIssue(parsed.error) };
  }
  const data = parsed.data;

  if (data.productId !== product.id) {
    return { ok: false, error: "Product mismatch" };
  }
  if (product.stockQuantity < data.quantity) {
    return {
      ok: false,
      error: `Insufficient stock for "${product.name}"`,
    };
  }

  const unitPriceAtSale = product.sellingPrice;
  const defaultTotal = unitPriceAtSale * data.quantity;
  const totalOwed = data.totalOwed ?? defaultTotal;

  const debtId = id();
  const movId = id();

  const chunks: TransactionChunk<any, any>[] = [
    db.tx.creditDebts[debtId].update({
      customerName: data.customerName.trim(),
      quantity: data.quantity,
      unitPriceAtSale,
      totalOwed,
      paidSoFar: 0,
      notes: data.notes?.trim() || undefined,
      createdAt: Date.now(),
      status: CREDIT_DEBT_STATUS.open,
    }),
    db.tx.creditDebts[debtId].link({ creator: userId }),
    db.tx.creditDebts[debtId].link({ product: data.productId }),
    db.tx.products[data.productId].update({
      stockQuantity: product.stockQuantity - data.quantity,
    }),
    db.tx.stockMovements[movId].update({
      kind: "pay_later",
      quantityDelta: -data.quantity,
      createdAt: Date.now(),
      note: `Pay later · ${data.customerName.trim()}`,
      relatedSaleId: debtId,
    }),
    db.tx.stockMovements[movId].link({ product: data.productId }),
  ];

  const res = await runTransact(chunks);
  if (!res.ok) return res;
  return { ok: true, data: { id: debtId }, syncStatus: res.syncStatus };
}

export async function recordCreditPaymentClient(
  input: unknown,
  debt: {
    id: string;
    totalOwed: number;
    paidSoFar: number;
    status: string;
  },
): Promise<ClientTransactResult> {
  const parsed = recordCreditPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: zodFirstIssue(parsed.error) };
  }
  const data = parsed.data;

  if (data.debtId !== debt.id) {
    return { ok: false, error: "Record mismatch" };
  }
  if (debt.status === CREDIT_DEBT_STATUS.settled) {
    return { ok: false, error: "This balance is already settled" };
  }

  const remaining = debt.totalOwed - debt.paidSoFar;
  if (remaining <= 0) {
    return { ok: false, error: "Nothing left to collect" };
  }

  const payment = Math.min(data.amount, remaining);
  const nextPaid = debt.paidSoFar + payment;
  const settled = nextPaid >= debt.totalOwed;

  return runTransact([
    db.tx.creditDebts[data.debtId].update({
      paidSoFar: nextPaid,
      status: settled ? CREDIT_DEBT_STATUS.settled : CREDIT_DEBT_STATUS.open,
    }),
  ]);
}
