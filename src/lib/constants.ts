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

export const ROLES = {
  super_admin: "super_admin",
  admin: "admin",
  staff: "staff",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Admin-only areas (reports, etc.); super admin is included. */
export function isAdminRole(role: string | undefined): boolean {
  return role === ROLES.admin || role === ROLES.super_admin;
}

export const INSTALLMENT_STATUS = {
  active: "active",
  completed: "completed",
} as const;

export const CREDIT_DEBT_STATUS = {
  open: "open",
  settled: "settled",
} as const;
