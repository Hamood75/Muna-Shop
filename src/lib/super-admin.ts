/** Server-only: comma-separated emails in SUPER_ADMIN_EMAIL become super_admin on login / profile create. */
export function isSuperAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const list = (process.env.SUPER_ADMIN_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}
