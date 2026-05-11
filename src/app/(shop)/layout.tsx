import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-server";
import { ensureProfileAction } from "@/actions/profile";
import { ShopShell } from "@/components/layout/shop-shell";

export default async function ShopLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const boot = await ensureProfileAction();

  return (
    <ShopShell bootError={boot.ok ? undefined : boot.error}>
      {children}
    </ShopShell>
  );
}
