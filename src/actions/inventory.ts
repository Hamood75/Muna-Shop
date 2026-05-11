"use server";

import { id } from "@instantdb/admin";
import type { ActionResult } from "@/actions/profile";
import { getAdminDb } from "@/lib/admin-db";
import { requireSessionUser } from "@/lib/auth-server";
import { stockAdjustSchema } from "@/lib/validations/inventory";
import { instantActionErrorMessage } from "@/lib/instant-errors";

export async function adjustStockAction(input: unknown): Promise<ActionResult> {
  try {
    await requireSessionUser();
    const data = stockAdjustSchema.parse(input);
    const db = getAdminDb();

    const res = await db.query({
      products: {
        $: { where: { id: data.productId } },
      },
    });

    const product = res.products?.[0];
    if (!product) throw new Error("Product not found");

    const next = product.stockQuantity + data.delta;
    if (next < 0) throw new Error("Stock cannot go negative");

    const movId = id();
    await db.transact([
      db.tx.products[data.productId].update({ stockQuantity: next }),
      db.tx.stockMovements[movId].update({
        kind: data.kind,
        quantityDelta: data.delta,
        note: data.note?.trim() || undefined,
        createdAt: Date.now(),
      }),
      db.tx.stockMovements[movId].link({ product: data.productId }),
    ]);

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: instantActionErrorMessage(e),
    };
  }
}
