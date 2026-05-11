"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Warehouse,
  BarChart3,
  Menu,
  PanelLeftClose,
  PanelLeft,
  Store,
  Users,
  CalendarClock,
  Handshake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/constants";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
  { href: "/installments", label: "Installments", icon: CalendarClock },
  { href: "/pay-later", label: "Pay later", icon: Handshake },
  { href: "/inventory", label: "Inventory", icon: Warehouse },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

export function AppSidebar({
  collapsed,
  onToggleCollapse,
  showCollapse = true,
  onNavClick,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  showCollapse?: boolean;
  onNavClick?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border/80 bg-card/90 backdrop-blur-md transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-[260px]",
      )}
    >
      <div
        className={cn(
          "flex h-[3.75rem] items-center gap-2 px-3",
          collapsed && "justify-between",
        )}
      >
        {showCollapse ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeft className="size-5" />
            ) : (
              <PanelLeftClose className="size-5" />
            )}
          </Button>
        ) : null}
        {!collapsed && (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
              <Store className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold tracking-tight text-foreground">
                Muna Shop
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Muna Shop · inventory & sales
              </p>
            </div>
          </div>
        )}
        {collapsed ? (
          <div className="flex flex-1 justify-center">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
              <Store className="size-5" aria-hidden />
            </div>
          </div>
        ) : null}
      </div>
      <Separator className="opacity-80" />
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {nav.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onNavClick?.()}
              className="outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card rounded-lg"
            >
              <span
                className={cn(
                  "relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                  active
                    ? "bg-primary/12 text-foreground shadow-sm dark:bg-primary/15"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                {active ? (
                  <span
                    className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-primary"
                    aria-hidden
                  />
                ) : null}
                <Icon
                  className={cn(
                    "size-5 shrink-0",
                    active ? "text-primary" : undefined,
                  )}
                  aria-hidden
                />
                {!collapsed && item.label}
              </span>
            </Link>
          );
        })}
        <SuperAdminTeamNavLink
          collapsed={collapsed}
          pathname={pathname}
          onNavClick={onNavClick}
        />
      </nav>
      {!collapsed ? (
        <div className="mt-auto border-t border-border/80 p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Muna Shop — stock, revenue, and customer payment plans in one
            workspace.
          </p>
        </div>
      ) : null}
    </aside>
  );
}

function SuperAdminTeamNavLink({
  collapsed,
  pathname,
  onNavClick,
}: {
  collapsed: boolean;
  pathname: string;
  onNavClick?: () => void;
}) {
  const { user } = db.useAuth();
  const { data } = db.useQuery(
    user?.id
      ? {
          profiles: {
            $: { where: { "user.id": user.id } },
          },
        }
      : null,
  );
  const role = data?.profiles?.[0]?.role;
  if (role !== ROLES.super_admin) return null;

  const href = "/team";
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const Icon = Users;

  return (
    <Link
      href={href}
      onClick={() => onNavClick?.()}
      className="outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card rounded-lg"
    >
      <span
        className={cn(
          "relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200",
          active
            ? "bg-primary/12 text-foreground shadow-sm dark:bg-primary/15"
            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        {active ? (
          <span
            className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-primary"
            aria-hidden
          />
        ) : null}
        <Icon
          className={cn(
            "size-5 shrink-0",
            active ? "text-primary" : undefined,
          )}
          aria-hidden
        />
        {!collapsed && "Team"}
      </span>
    </Link>
  );
}

export function MobileNavTrigger({
  open,
  onOpen,
}: {
  open: boolean;
  onOpen: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="border-border/90 shadow-sm lg:hidden"
      onClick={onOpen}
      aria-expanded={open}
      aria-label="Open menu"
    >
      <Menu className="size-5" />
    </Button>
  );
}
