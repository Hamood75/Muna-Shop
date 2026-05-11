"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { SyncStatusBanner } from "@/components/sync-status-banner";
import { cn } from "@/lib/utils";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/products": "Products",
  "/sales": "Sales",
  "/installments": "Installments",
  "/pay-later": "Pay later",
  "/inventory": "Inventory",
  "/reports": "Reports",
  "/team": "Team",
};

export function ShopShell({
  bootError,
  children,
}: {
  bootError?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? "Muna Shop";

  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen text-foreground">
      <div className="hidden lg:flex">
        <AppSidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          showCollapse
        />
      </div>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[260px] border-r border-border/80 bg-card/95 shadow-xl backdrop-blur-md transition-transform duration-200 ease-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <AppSidebar
          collapsed={false}
          onToggleCollapse={() => setMobileOpen(false)}
          showCollapse={false}
          onNavClick={() => setMobileOpen(false)}
        />
      </div>
      <div className="flex min-h-screen flex-1 flex-col">
        <Header
          title={title}
          onMobileNav={() => setMobileOpen(true)}
          mobileNavOpen={mobileOpen}
        />
        <SyncStatusBanner />
        {bootError ? (
          <div className="border-b border-amber-500/35 bg-amber-500/[0.09] px-4 py-3 text-sm text-amber-950 dark:text-amber-50">
            Profile sync issue: {bootError}. Ensure{" "}
            <code className="rounded-md bg-background/60 px-1.5 py-0.5 font-mono text-xs">
              INSTANT_APP_ADMIN_TOKEN
            </code>{" "}
            is set for server actions.
          </div>
        ) : null}
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 lg:px-10">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
