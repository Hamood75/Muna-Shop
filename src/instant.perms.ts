// Docs: https://www.instantdb.com/docs/permissions

import type { InstantRules } from "@instantdb/react";
import type { AppSchema } from "./instant.schema";

const auth = "auth.id != null";

/**
 * Authenticated shop staff can use the app.
 * Each user may only view their own profile row; role changes use Admin SDK (server actions).
 */
const rules = {
  profiles: {
    allow: {
      view: "auth.id in data.ref('user.id')",
      create: "false",
      update: "auth.id in data.ref('user.id')",
      delete: "false",
    },
    fields: {
      role: "false",
    },
  },
  products: {
    allow: {
      view: auth,
      create: auth,
      update: auth,
      delete: auth,
    },
  },
  sales: {
    allow: {
      view: auth,
      create: auth,
      update: auth,
      delete: auth,
    },
  },
  saleItems: {
    allow: {
      view: auth,
      create: auth,
      update: auth,
      delete: auth,
    },
  },
  stockMovements: {
    allow: {
      view: auth,
      create: auth,
      update: auth,
      delete: auth,
    },
  },
  installmentPlans: {
    allow: {
      view: auth,
      create: auth,
      update: auth,
      delete: auth,
    },
  },
  installmentItems: {
    allow: {
      view: auth,
      create: auth,
      update: auth,
      delete: auth,
    },
  },
  creditDebts: {
    allow: {
      view: auth,
      create: auth,
      update: auth,
      delete: auth,
    },
  },
  $files: {
    allow: {
      view: auth,
      create: auth,
      update: auth,
      delete: auth,
    },
  },
} satisfies InstantRules<AppSchema>;

export default rules;
