// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
      imageURL: i.string().optional(),
      type: i.string().optional(),
    }),
    profiles: i.entity({
      role: i.string().indexed(),
      displayName: i.string().optional(),
      createdAt: i.number().indexed(),
    }),
    products: i.entity({
      name: i.string().indexed(),
      barcode: i.string().unique().indexed().optional(),
      buyingPrice: i.number(),
      sellingPrice: i.number(),
      stockQuantity: i.number().indexed(),
      imageUrl: i.string().optional(),
      createdAt: i.number().indexed(),
    }),
    sales: i.entity({
      totalAmount: i.number().indexed(),
      createdAt: i.number().indexed(),
      note: i.string().optional(),
    }),
    saleItems: i.entity({
      quantity: i.number(),
      unitPrice: i.number(),
      lineTotal: i.number(),
    }),
    stockMovements: i.entity({
      kind: i.string().indexed(),
      quantityDelta: i.number(),
      note: i.string().optional(),
      createdAt: i.number().indexed(),
      relatedSaleId: i.string().optional(),
    }),
    /** Customer buys now; balance collected over multiple payments. Stock leaves on creation. */
    installmentPlans: i.entity({
      customerName: i.string().indexed(),
      totalAmount: i.number().indexed(),
      paidSoFar: i.number(),
      notes: i.string().optional(),
      createdAt: i.number().indexed(),
      status: i.string().indexed(),
    }),
    installmentItems: i.entity({
      quantity: i.number(),
      unitPrice: i.number(),
      lineTotal: i.number(),
    }),
    /** Customer took stock; pays the balance later (IOU). */
    creditDebts: i.entity({
      customerName: i.string().indexed(),
      quantity: i.number(),
      unitPriceAtSale: i.number(),
      totalOwed: i.number().indexed(),
      paidSoFar: i.number(),
      notes: i.string().optional(),
      createdAt: i.number().indexed(),
      status: i.string().indexed(),
    }),
  },
  links: {
    profileUser: {
      forward: {
        on: "profiles",
        has: "one",
        label: "user",
        onDelete: "cascade",
      },
      reverse: {
        on: "$users",
        has: "one",
        label: "profile",
      },
    },
    saleCreator: {
      forward: {
        on: "sales",
        has: "one",
        label: "creator",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "sales",
      },
    },
    saleItemSale: {
      forward: {
        on: "saleItems",
        has: "one",
        label: "sale",
        onDelete: "cascade",
      },
      reverse: {
        on: "sales",
        has: "many",
        label: "items",
      },
    },
    saleItemProduct: {
      forward: {
        on: "saleItems",
        has: "one",
        label: "product",
      },
      reverse: {
        on: "products",
        has: "many",
        label: "saleItems",
      },
    },
    stockMovementProduct: {
      forward: {
        on: "stockMovements",
        has: "one",
        label: "product",
        onDelete: "cascade",
      },
      reverse: {
        on: "products",
        has: "many",
        label: "stockMovements",
      },
    },
    installmentPlanCreator: {
      forward: {
        on: "installmentPlans",
        has: "one",
        label: "creator",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "installmentPlans",
      },
    },
    installmentItemPlan: {
      forward: {
        on: "installmentItems",
        has: "one",
        label: "plan",
        onDelete: "cascade",
      },
      reverse: {
        on: "installmentPlans",
        has: "many",
        label: "items",
      },
    },
    installmentItemProduct: {
      forward: {
        on: "installmentItems",
        has: "one",
        label: "product",
      },
      reverse: {
        on: "products",
        has: "many",
        label: "installmentItems",
      },
    },
    creditDebtCreator: {
      forward: {
        on: "creditDebts",
        has: "one",
        label: "creator",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "creditDebts",
      },
    },
    creditDebtProduct: {
      forward: {
        on: "creditDebts",
        has: "one",
        label: "product",
      },
      reverse: {
        on: "products",
        has: "many",
        label: "creditDebts",
      },
    },
  },
});

type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
