import { z } from "zod";

export const productCreateSchema = z.object({
  name: z.string().min(1),
  barcode: z.string().optional(),
  buyingPrice: z.coerce.number().nonnegative(),
  sellingPrice: z.coerce.number().nonnegative(),
  stockQuantity: z.coerce.number().int().nonnegative(),
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
