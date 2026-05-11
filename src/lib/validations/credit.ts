import { z } from "zod";
import { saleLineSchema } from "@/lib/validations/inventory";

export const createInstallmentPlanSchema = z
  .object({
    customerName: z.string().trim().min(1).max(200),
    items: z.array(saleLineSchema).min(1),
    notes: z.string().optional(),
    initialPayment: z.coerce.number().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.initialPayment !== undefined &&
      Number.isFinite(data.initialPayment) &&
      data.initialPayment > 1e12
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Initial payment looks invalid",
        path: ["initialPayment"],
      });
    }
  });

export const recordInstallmentPaymentSchema = z.object({
  planId: z.string().min(1),
  amount: z.coerce.number().positive(),
});

export const createCreditDebtSchema = z.object({
  customerName: z.string().trim().min(1).max(200),
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  /** If omitted, server uses quantity × current selling price. */
  totalOwed: z.coerce.number().positive().optional(),
  notes: z.string().optional(),
});

export const recordCreditPaymentSchema = z.object({
  debtId: z.string().min(1),
  amount: z.coerce.number().positive(),
});
