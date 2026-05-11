"use server";

import { id, type TransactionChunk } from "@instantdb/admin";
import type { ActionResult } from "@/actions/profile";
import { INSTALLMENT_STATUS } from "@/lib/constants";
import { getAdminDb } from "@/lib/admin-db";
import { requireSessionUser } from "@/lib/auth-server";
import { instantActionErrorMessage } from "@/lib/instant-errors";
import {
  createInstallmentPlanSchema,
  recordInstallmentPaymentSchema,
} from "@/lib/validations/credit";

export async function createInstallmentPlanAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireSessionUser();
    const data = createInstallmentPlanSchema.parse(input);
    const db = getAdminDb();

    const ids = [...new Set(data.items.map((i) => i.productId))];
    const loaded = await db.query({
      products: {
        $: { where: { id: { $in: ids } } },
      },
    });

    const byId = new Map((loaded.products ?? []).map((p) => [p.id, p]));

    let totalAmount = 0;
    const lineMeta: {
      productId: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      nextStock: number;
    }[] = [];

    for (const line of data.items) {
      const p = byId.get(line.productId);
      if (!p) throw new Error(`Unknown product: ${line.productId}`);
      const unitPrice = p.sellingPrice;
      const lineTotal = unitPrice * line.quantity;
      if (p.stockQuantity < line.quantity) {
        throw new Error(`Insufficient stock for "${p.name}"`);
      }
      totalAmount += lineTotal;
      lineMeta.push({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice,
        lineTotal,
        nextStock: p.stockQuantity - line.quantity,
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
      db.tx.installmentPlans[planId].link({ creator: user.id }),
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

    await db.transact(chunks);
    return { ok: true, data: { id: planId } };
  } catch (e) {
    return {
      ok: false,
      error: instantActionErrorMessage(e),
    };
  }
}

export async function recordInstallmentPaymentAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    await requireSessionUser();
    const data = recordInstallmentPaymentSchema.parse(input);
    const db = getAdminDb();

    const res = await db.query({
      installmentPlans: {
        $: { where: { id: data.planId } },
      },
    });

    const plan = res.installmentPlans?.[0];
    if (!plan) throw new Error("Installment plan not found");
    if (plan.status === INSTALLMENT_STATUS.completed) {
      throw new Error("This plan is already paid in full");
    }

    const remaining = plan.totalAmount - plan.paidSoFar;
    if (remaining <= 0) {
      throw new Error("Nothing left to pay");
    }

    const payment = Math.min(data.amount, remaining);
    const nextPaid = plan.paidSoFar + payment;
    const completed = nextPaid >= plan.totalAmount;

    await db.transact([
      db.tx.installmentPlans[data.planId].update({
        paidSoFar: nextPaid,
        status: completed
          ? INSTALLMENT_STATUS.completed
          : INSTALLMENT_STATUS.active,
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
