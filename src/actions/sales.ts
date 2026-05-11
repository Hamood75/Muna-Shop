"use server";

import { id, type TransactionChunk } from "@instantdb/admin";
import type { ActionResult } from "@/actions/profile";
import { getAdminDb } from "@/lib/admin-db";
import { requireSessionUser } from "@/lib/auth-server";
import { recordSaleSchema } from "@/lib/validations/inventory";
import { instantActionErrorMessage } from "@/lib/instant-errors";

export async function recordSaleAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireSessionUser();
    const data = recordSaleSchema.parse(input);
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

    const saleId = id();
    const chunks: TransactionChunk<any, any>[] = [
      db.tx.sales[saleId].update({
        totalAmount,
        createdAt: Date.now(),
        note: data.note?.trim() || undefined,
      }),
      db.tx.sales[saleId].link({ creator: user.id }),
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

    await db.transact(chunks);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: instantActionErrorMessage(e),
    };
  }
}
