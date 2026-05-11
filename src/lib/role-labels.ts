import { ROLES } from "@/lib/constants";

const LABELS: Record<string, string> = {
  [ROLES.super_admin]: "Super admin",
  [ROLES.admin]: "Admin",
  [ROLES.staff]: "Staff",
  /** Legacy rows before rename */
  shopkeeper: "Staff",
};

export function formatRoleLabel(role: string): string {
  return LABELS[role] ?? role.replace(/_/g, " ");
}
