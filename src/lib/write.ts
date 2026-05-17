import { z } from "zod";
import type { Product } from "@/lib/entities";
import {
  CREDIT_DEBT_STATUS,
  INSTALLMENT_STATUS,
  ROLES,
} from "@/lib/constants";
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
import { getDb } from "@/lib/sqlite-db";

export type ClientTransactResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/** Kept for call-site compatibility; local DB is always immediate. */
export function appendSyncHint(message: string, _syncIgnored?: unknown): string {
  return message;
}

type ProductSnapshot = Pick<
  Product,
  "id" | "name" | "sellingPrice" | "stockQuantity"
>;

function zodFirstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

function sqlErr(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("UNIQUE") && msg.toLowerCase().includes("barcode")) {
    return "Barcode already exists for another product";
  }
  return msg;
}

export async function recordSaleClient(
  profileId: string | undefined,
  input: unknown,
  products: ProductSnapshot[],
): Promise<ClientTransactResult> {
  if (!profileId) {
    return { ok: false, error: "No active profile" };
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

  const db = await getDb();
  const saleId = crypto.randomUUID();
  const now = Date.now();

  try {
    await db.execute("BEGIN IMMEDIATE");
    await db.execute(
      `INSERT INTO sales (id, total_amount, created_at, note, creator_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        saleId,
        totalAmount,
        now,
        data.note?.trim() || null,
        profileId,
      ],
    );

    for (const line of lineMeta) {
      const saleItemId = crypto.randomUUID();
      await db.execute(
        `INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          saleItemId,
          saleId,
          line.productId,
          line.quantity,
          line.unitPrice,
          line.lineTotal,
        ],
      );
      await db.execute(
        `UPDATE products SET stock_quantity = ? WHERE id = ?`,
        [line.nextStock, line.productId],
      );

      const movId = crypto.randomUUID();
      await db.execute(
        `INSERT INTO stock_movements (id, product_id, kind, quantity_delta, note, created_at, related_sale_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          movId,
          line.productId,
          "sale",
          -line.quantity,
          "Sale",
          now,
          saleId,
        ],
      );
    }
    await db.execute("COMMIT");
    return { ok: true };
  } catch (e) {
    try {
      await db.execute("ROLLBACK");
    } catch {
      /* ignore */
    }
    return { ok: false, error: sqlErr(e) };
  }
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

  const db = await getDb();
  const movId = crypto.randomUUID();
  const now = Date.now();

  try {
    await db.execute("BEGIN IMMEDIATE");
    await db.execute(
      `UPDATE products SET stock_quantity = ? WHERE id = ?`,
      [next, data.productId],
    );
    await db.execute(
      `INSERT INTO stock_movements (id, product_id, kind, quantity_delta, note, created_at, related_sale_id)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      [
        movId,
        data.productId,
        data.kind,
        data.delta,
        data.note?.trim() || null,
        now,
      ],
    );
    await db.execute("COMMIT");
    return { ok: true };
  } catch (e) {
    try {
      await db.execute("ROLLBACK");
    } catch {
      /* ignore */
    }
    return { ok: false, error: sqlErr(e) };
  }
}

export async function createProductClient(
  input: unknown,
): Promise<ClientTransactResult<{ id: string }>> {
  const parsed = productCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: zodFirstIssue(parsed.error) };
  }
  const data = parsed.data;
  const pid = crypto.randomUUID();
  const db = await getDb();
  const now = Date.now();

  try {
    await db.execute(
      `INSERT INTO products (id, name, barcode, buying_price, selling_price, stock_quantity, image_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
      [
        pid,
        data.name.trim(),
        data.barcode?.trim() || null,
        data.buyingPrice,
        data.sellingPrice,
        data.stockQuantity,
        now,
      ],
    );
    return { ok: true, data: { id: pid } };
  } catch (e) {
    return { ok: false, error: sqlErr(e) };
  }
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

  const fields: string[] = [];
  const vals: unknown[] = [];

  if (rest.name !== undefined) {
    fields.push("name = ?");
    vals.push(rest.name.trim());
  }
  if (rest.barcode !== undefined) {
    fields.push("barcode = ?");
    vals.push(rest.barcode.trim() || null);
  }
  if (rest.buyingPrice !== undefined) {
    fields.push("buying_price = ?");
    vals.push(rest.buyingPrice);
  }
  if (rest.sellingPrice !== undefined) {
    fields.push("selling_price = ?");
    vals.push(rest.sellingPrice);
  }
  if (rest.stockQuantity !== undefined) {
    fields.push("stock_quantity = ?");
    vals.push(rest.stockQuantity);
  }

  if (!fields.length) return { ok: true };

  vals.push(productId);
  const db = await getDb();
  try {
    await db.execute(
      `UPDATE products SET ${fields.join(", ")} WHERE id = ?`,
      vals,
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: sqlErr(e) };
  }
}

export async function deleteProductClient(
  productId: string,
): Promise<ClientTransactResult> {
  if (!productId.trim()) {
    return { ok: false, error: "Missing product id" };
  }
  const db = await getDb();
  const chk = await db.select<{ n: number }[]>(
    `SELECT
       (SELECT COUNT(*) FROM sale_items WHERE product_id = ?) +
       (SELECT COUNT(*) FROM installment_items WHERE product_id = ?) +
       (SELECT COUNT(*) FROM credit_debts WHERE product_id = ?) AS n`,
    [productId, productId, productId],
  );
  const n = chk[0]?.n ?? 0;
  if (n > 0) {
    return {
      ok: false,
      error:
        "Cannot delete a product that appears on sales, installment plans, or pay-later records.",
    };
  }

  try {
    await db.execute("BEGIN IMMEDIATE");
    await db.execute(
      "DELETE FROM stock_movements WHERE product_id = ?",
      [productId],
    );
    await db.execute("DELETE FROM products WHERE id = ?", [productId]);
    await db.execute("COMMIT");
    return { ok: true };
  } catch (e) {
    try {
      await db.execute("ROLLBACK");
    } catch {
      /* ignore */
    }
    return { ok: false, error: sqlErr(e) };
  }
}

export async function createInstallmentPlanClient(
  profileId: string | undefined,
  input: unknown,
  products: ProductSnapshot[],
): Promise<ClientTransactResult<{ id: string }>> {
  if (!profileId) {
    return { ok: false, error: "No active profile" };
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
  const planId = crypto.randomUUID();
  const now = Date.now();
  const status =
    initial >= totalAmount
      ? INSTALLMENT_STATUS.completed
      : INSTALLMENT_STATUS.active;

  const db = await getDb();

  try {
    await db.execute("BEGIN IMMEDIATE");
    await db.execute(
      `INSERT INTO installment_plans (id, customer_name, total_amount, paid_so_far, notes, created_at, status, creator_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        planId,
        data.customerName.trim(),
        totalAmount,
        initial,
        data.notes?.trim() || null,
        now,
        status,
        profileId,
      ],
    );

    for (const line of lineMeta) {
      const itemId = crypto.randomUUID();
      await db.execute(
        `INSERT INTO installment_items (id, plan_id, product_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          planId,
          line.productId,
          line.quantity,
          line.unitPrice,
          line.lineTotal,
        ],
      );
      await db.execute(
        `UPDATE products SET stock_quantity = ? WHERE id = ?`,
        [line.nextStock, line.productId],
      );

      const movId = crypto.randomUUID();
      await db.execute(
        `INSERT INTO stock_movements (id, product_id, kind, quantity_delta, note, created_at, related_sale_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          movId,
          line.productId,
          "installment",
          -line.quantity,
          `Installment · ${data.customerName.trim()}`,
          now,
          planId,
        ],
      );
    }
    await db.execute("COMMIT");
    return { ok: true, data: { id: planId } };
  } catch (e) {
    try {
      await db.execute("ROLLBACK");
    } catch {
      /* ignore */
    }
    return { ok: false, error: sqlErr(e) };
  }
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
  const nextStatus = completed
    ? INSTALLMENT_STATUS.completed
    : INSTALLMENT_STATUS.active;

  const db = await getDb();
  try {
    await db.execute(
      `UPDATE installment_plans SET paid_so_far = ?, status = ? WHERE id = ?`,
      [nextPaid, nextStatus, data.planId],
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: sqlErr(e) };
  }
}

export async function createCreditDebtClient(
  profileId: string | undefined,
  input: unknown,
  product: ProductSnapshot,
): Promise<ClientTransactResult<{ id: string }>> {
  if (!profileId) {
    return { ok: false, error: "No active profile" };
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

  const debtId = crypto.randomUUID();
  const movId = crypto.randomUUID();
  const now = Date.now();
  const nextStock = product.stockQuantity - data.quantity;

  const db = await getDb();

  try {
    await db.execute("BEGIN IMMEDIATE");
    await db.execute(
      `INSERT INTO credit_debts (id, customer_name, quantity, unit_price_at_sale, total_owed, paid_so_far, notes, created_at, status, creator_id, product_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        debtId,
        data.customerName.trim(),
        data.quantity,
        unitPriceAtSale,
        totalOwed,
        0,
        data.notes?.trim() || null,
        now,
        CREDIT_DEBT_STATUS.open,
        profileId,
        data.productId,
      ],
    );
    await db.execute(
      `UPDATE products SET stock_quantity = ? WHERE id = ?`,
      [nextStock, data.productId],
    );
    await db.execute(
      `INSERT INTO stock_movements (id, product_id, kind, quantity_delta, note, created_at, related_sale_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        movId,
        data.productId,
        "pay_later",
        -data.quantity,
        `Pay later · ${data.customerName.trim()}`,
        now,
        debtId,
      ],
    );
    await db.execute("COMMIT");
    return { ok: true, data: { id: debtId } };
  } catch (e) {
    try {
      await db.execute("ROLLBACK");
    } catch {
      /* ignore */
    }
    return { ok: false, error: sqlErr(e) };
  }
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
  const nextStatus = settled
    ? CREDIT_DEBT_STATUS.settled
    : CREDIT_DEBT_STATUS.open;

  const db = await getDb();
  try {
    await db.execute(
      `UPDATE credit_debts SET paid_so_far = ?, status = ? WHERE id = ?`,
      [nextPaid, nextStatus, data.debtId],
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: sqlErr(e) };
  }
}

export async function addTeamProfile(
  displayName: string,
  role: typeof ROLES.admin | typeof ROLES.staff,
): Promise<ClientTransactResult<{ id: string }>> {
  const name = displayName.trim();
  if (!name) return { ok: false, error: "Display name required" };
  const db = await getDb();
  const id = crypto.randomUUID();
  try {
    await db.execute(
      `INSERT INTO profiles (id, role, display_name, created_at) VALUES (?, ?, ?, ?)`,
      [id, role, name, Date.now()],
    );
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, error: sqlErr(e) };
  }
}

export async function setMemberRole(
  profileId: string,
  role: typeof ROLES.admin | typeof ROLES.staff,
): Promise<ClientTransactResult> {
  const db = await getDb();
  const rows = await db.select<{ role: string }[]>(
    "SELECT role FROM profiles WHERE id = ? LIMIT 1",
    [profileId],
  );
  const current = rows[0]?.role;
  if (!current) return { ok: false, error: "Profile not found" };
  if (current === ROLES.super_admin) {
    return { ok: false, error: "Super admin role cannot be changed here." };
  }
  if (role === current) return { ok: true };
  try {
    await db.execute(`UPDATE profiles SET role = ? WHERE id = ?`, [
      role,
      profileId,
    ]);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: sqlErr(e) };
  }
}
