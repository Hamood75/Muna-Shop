"use client";

import * as React from "react";
import { Moon, Sun, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { formatRoleLabel } from "@/lib/role-labels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileNavTrigger } from "@/components/layout/app-sidebar";

/** Only mount when `userId` is a real Instant user id — avoids invalid `where` UUID validation. */
function ProfileRoleBadge({ userId }: { userId: string }) {
  const { data } = db.useQuery({
    profiles: {
      $: { where: { "user.id": userId } },
    },
  });

  const role = data?.profiles?.[0]?.role ?? ROLES.staff;

  return (
    <Badge variant="secondary" className="hidden sm:inline-flex">
      {formatRoleLabel(role)}
    </Badge>
  );
}

export function Header({
  title,
  onMobileNav,
  mobileNavOpen,
}: {
  title: string;
  onMobileNav?: () => void;
  mobileNavOpen?: boolean;
}) {
  const { setTheme, resolvedTheme } = useTheme();
  const { user, isLoading } = db.useAuth();

  async function handleSignOut() {
    await db.auth.signOut();
    window.location.href = "/login";
  }

  const subtitle = React.useMemo(() => {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    }).format(new Date());
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl dark:bg-background/75 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)] md:px-8 lg:px-10">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        {onMobileNav ? (
          <MobileNavTrigger open={!!mobileNavOpen} onOpen={onMobileNav} />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            {title}
          </h1>
          <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
            {subtitle}
          </p>
        </div>
        {isLoading ? (
          <Badge variant="secondary" className="hidden sm:inline-flex">
            …
          </Badge>
        ) : user?.id ? (
          <ProfileRoleBadge userId={user.id} />
        ) : (
          <Badge variant="secondary" className="hidden sm:inline-flex">
            …
          </Badge>
        )}
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="border-border/90 shadow-sm"
            aria-label="Toggle theme"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            <Sun className="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className="hidden rounded-full px-4 shadow-sm sm:inline-flex"
            >
              Account
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[10rem]">
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onClick={() => void handleSignOut()}
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
