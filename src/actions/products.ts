"use server";

import { id } from "@instantdb/admin";
import type { ActionResult } from "@/actions/profile";
import { getAdminDb } from "@/lib/admin-db";
import { requireSessionUser } from "@/lib/auth-server";
import {
  productCreateSchema,
  productUpdateSchema,
} from "@/lib/validations/inventory";
import { instantActionErrorMessage } from "@/lib/instant-errors";

export async function createProductAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireSessionUser();
    const data = productCreateSchema.parse(input);
    const db = getAdminDb();
    const pid = id();

    await db.transact([
      db.tx.products[pid].update({
        name: data.name.trim(),
        barcode: data.barcode?.trim() || undefined,
        buyingPrice: data.buyingPrice,
        sellingPrice: data.sellingPrice,
        stockQuantity: data.stockQuantity,
        createdAt: Date.now(),
      }),
    ]);
    return { ok: true, data: { id: pid } };
  } catch (e) {
    return {
      ok: false,
      error: instantActionErrorMessage(e),
    };
  }
}

export async function updateProductAction(input: unknown): Promise<ActionResult> {
  try {
    await requireSessionUser();
    const data = productUpdateSchema.parse(input);
    const db = getAdminDb();
    const { id: productId, ...rest } = data;

    const payload: Record<string, unknown> = {};
    if (rest.name !== undefined) payload.name = rest.name.trim();
    if (rest.barcode !== undefined)
      payload.barcode = rest.barcode.trim() || undefined;
    if (rest.buyingPrice !== undefined) payload.buyingPrice = rest.buyingPrice;
    if (rest.sellingPrice !== undefined)
      payload.sellingPrice = rest.sellingPrice;
    if (rest.stockQuantity !== undefined)
      payload.stockQuantity = rest.stockQuantity;

    await db.transact([db.tx.products[productId].update(payload)]);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: instantActionErrorMessage(e),
    };
  }
}

export async function deleteProductAction(productId: string): Promise<ActionResult> {
  try {
    await requireSessionUser();
    const db = getAdminDb();
    await db.transact([db.tx.products[productId].delete()]);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: instantActionErrorMessage(e),
    };
  }
}
