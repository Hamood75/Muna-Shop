import { z } from "zod";

/** Stored on each product: average cost per unit (used for profit / P&L). */
export const productCreateSchema = z.object({
  name: z.string().min(1),
  barcode: z.string().optional(),
  buyingPrice: z.coerce.number().nonnegative(),
  sellingPrice: z.coerce.number().nonnegative(),
  stockQuantity: z.coerce.number().nonnegative(),
});

/**
 * Create form: user enters wholesale lot total and how many units were in the lot;
 * we derive per-unit cost as total ÷ units. Opening stock is usually the same count.
 */
export const productCreateFormSchema = z
  .object({
    name: z.string().min(1),
    barcode: z.string().optional(),
    wholesaleLotTotal: z.coerce.number(),
    unitsPurchased: z.coerce.number(),
    openingStock: z.coerce.number(),
    sellingPrice: z.coerce.number().nonnegative(),
  })
  .superRefine((data, ctx) => {
    if (data.wholesaleLotTotal <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter the total you paid for the wholesale pack",
        path: ["wholesaleLotTotal"],
      });
    }
    if (data.unitsPurchased <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Units in the purchase must be greater than zero",
        path: ["unitsPurchased"],
      });
    }
    if (data.openingStock < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Opening stock cannot be negative",
        path: ["openingStock"],
      });
    }
    if (data.openingStock > data.unitsPurchased) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Opening stock cannot be more than the units you purchased (unless you use stock adjustment later)",
        path: ["openingStock"],
      });
    }
  })
  .transform((data) => {
    const raw = data.wholesaleLotTotal / data.unitsPurchased;
    const buyingPrice = Math.round(raw * 10000) / 10000;
    return {
      name: data.name.trim(),
      barcode: data.barcode?.trim() || undefined,
      buyingPrice,
      sellingPrice: data.sellingPrice,
      stockQuantity: data.openingStock,
    };
  });

/**
 * Edit product: same wholesale inputs as create; stock is current on-hand qty (not tied to units purchased).
 */
export const productEditFormSchema = z
  .object({
    name: z.string().min(1),
    barcode: z.string().optional(),
    wholesaleLotTotal: z.coerce.number(),
    unitsPurchased: z.coerce.number(),
    stockQuantity: z.coerce.number(),
    sellingPrice: z.coerce.number().nonnegative(),
  })
  .superRefine((data, ctx) => {
    if (data.wholesaleLotTotal <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter the total you paid for the wholesale pack",
        path: ["wholesaleLotTotal"],
      });
    }
    if (data.unitsPurchased <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Units in the purchase must be greater than zero",
        path: ["unitsPurchased"],
      });
    }
    if (data.stockQuantity < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Stock quantity cannot be negative",
        path: ["stockQuantity"],
      });
    }
  })
  .transform((data) => {
    const raw = data.wholesaleLotTotal / data.unitsPurchased;
    const buyingPrice = Math.round(raw * 10000) / 10000;
    return {
      name: data.name.trim(),
      barcode: data.barcode?.trim() || undefined,
      buyingPrice,
      sellingPrice: data.sellingPrice,
      stockQuantity: data.stockQuantity,
    };
  });

export const productUpdateSchema = productCreateSchema.partial().extend({
  id: z.string().min(1),
});

export const saleLineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
});

export const recordSaleSchema = z.object({
  items: z.array(saleLineSchema).min(1),
  note: z.string().optional(),
});

export const stockAdjustSchema = z
  .object({
    productId: z.string().min(1),
    delta: z.coerce.number().int(),
    note: z.string().optional(),
    kind: z.enum(["restock", "adjustment", "damaged"]),
  })
  .superRefine((data, ctx) => {
    if (data.kind === "damaged" && data.delta >= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Damaged stock requires a negative quantity change",
        path: ["delta"],
      });
    }
    if (data.kind === "restock" && data.delta <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Restock requires a positive quantity",
        path: ["delta"],
      });
    }
  });
