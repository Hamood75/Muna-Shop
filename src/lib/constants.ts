/** Alert when on-hand is at or below this level (dashboard, catalog, POS). */
export const LOW_STOCK_THRESHOLD = 5;

export function isLowStock(onHand: number): boolean {
  return onHand <= LOW_STOCK_THRESHOLD;
}

/** Catalog list page size */
export const PRODUCTS_PAGE_SIZE = 10;

/** Recent stock movements list page size */
export const STOCK_MOVEMENTS_PAGE_SIZE = 10;

/** Dashboard "Recent sales" card */
export const DASHBOARD_RECENT_SALES_PAGE_SIZE = 3;

/** Reports "Sales by date" list (super admin) */
export const REPORTS_SALES_BY_DATE_PAGE_SIZE = 20;

/** Installment / pay-later payment history list */
export const PLAN_PAYMENTS_PAGE_SIZE = 20;

export const ROLES = {
  super_admin: "super_admin",
  admin: "admin",
  staff: "staff",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Admin-only areas; super admin is included. */
export function isAdminRole(role: string | undefined): boolean {
  return role === ROLES.admin || role === ROLES.super_admin;
}

/** Dashboard, reports, and team management. */
export function isSuperAdminRole(role: string | undefined): boolean {
  return role === ROLES.super_admin;
}

export const INSTALLMENT_STATUS = {
  active: "active",
  completed: "completed",
} as const;

export const CREDIT_DEBT_STATUS = {
  open: "open",
  settled: "settled",
} as const;

/** Cash collected from installment / pay-later payments (by payment date). */
export const CASH_COLLECTION_SOURCE = {
  installment: "installment",
  payLater: "pay_later",
} as const;
