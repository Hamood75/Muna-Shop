"use server";

import { id, type TransactionChunk } from "@instantdb/admin";
import type { ActionResult } from "@/actions/profile";
import { CREDIT_DEBT_STATUS } from "@/lib/constants";
import { getAdminDb } from "@/lib/admin-db";
import { requireSessionUser } from "@/lib/auth-server";
import { instantActionErrorMessage } from "@/lib/instant-errors";
import {
  createCreditDebtSchema,
  recordCreditPaymentSchema,
} from "@/lib/validations/credit";

export async function createCreditDebtAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireSessionUser();
    const data = createCreditDebtSchema.parse(input);
    const db = getAdminDb();

    const loaded = await db.query({
      products: {
        $: { where: { id: data.productId } },
      },
    });

    const product = loaded.products?.[0];
    if (!product) throw new Error("Product not found");
    if (product.stockQuantity < data.quantity) {
      throw new Error(`Insufficient stock for "${product.name}"`);
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
      db.tx.creditDebts[debtId].link({ creator: user.id }),
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

    await db.transact(chunks);
    return { ok: true, data: { id: debtId } };
  } catch (e) {
    return {
      ok: false,
      error: instantActionErrorMessage(e),
    };
  }
}

export async function recordCreditPaymentAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    await requireSessionUser();
    const data = recordCreditPaymentSchema.parse(input);
    const db = getAdminDb();

    const res = await db.query({
      creditDebts: {
        $: { where: { id: data.debtId } },
      },
    });

    const debt = res.creditDebts?.[0];
    if (!debt) throw new Error("Record not found");
    if (debt.status === CREDIT_DEBT_STATUS.settled) {
      throw new Error("This balance is already settled");
    }

    const remaining = debt.totalOwed - debt.paidSoFar;
    if (remaining <= 0) {
      throw new Error("Nothing left to collect");
    }

    const payment = Math.min(data.amount, remaining);
    const nextPaid = debt.paidSoFar + payment;
    const settled = nextPaid >= debt.totalOwed;

    await db.transact([
      db.tx.creditDebts[data.debtId].update({
        paidSoFar: nextPaid,
        status: settled
          ? CREDIT_DEBT_STATUS.settled
          : CREDIT_DEBT_STATUS.open,
      }),
    ]);

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: instantActionErrorMessage(e),
    };
  }
}
