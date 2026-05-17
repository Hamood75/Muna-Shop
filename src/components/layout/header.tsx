"use client";

import * as React from "react";
import { Moon, Sun, Users } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { ROLES } from "@/lib/constants";
import { formatRoleLabel } from "@/lib/role-labels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MobileNavTrigger } from "@/components/layout/app-sidebar";
import { useShopSession } from "@/context/shop-session";
import { getDb } from "@/lib/sqlite-db";
import {
  resetSuperAdminPasscodeWithRecovery,
  verifySuperAdminPasscode,
} from "@/lib/admin-passcode";

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
  const { profile, allProfiles, setActiveProfile } = useShopSession();

  const [superGateOpen, setSuperGateOpen] = React.useState(false);
  const [superGateTargetId, setSuperGateTargetId] = React.useState<
    string | null
  >(null);
  const [passcode, setPasscode] = React.useState("");
  const [superGateBusy, setSuperGateBusy] = React.useState(false);
  const [superGateView, setSuperGateView] = React.useState<
    "passcode" | "recovery"
  >("passcode");
  const [recoveryKeyInput, setRecoveryKeyInput] = React.useState("");
  const [recoveryNewPass, setRecoveryNewPass] = React.useState("");
  const [recoveryConfirmPass, setRecoveryConfirmPass] = React.useState("");

  const subtitle = React.useMemo(() => {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    }).format(new Date());
  }, []);

  function beginSwitchToProfile(targetId: string, targetRole: string) {
    if (targetId === profile?.id) return;
    if (targetRole === ROLES.super_admin) {
      setSuperGateTargetId(targetId);
      setPasscode("");
      setSuperGateView("passcode");
      setRecoveryKeyInput("");
      setRecoveryNewPass("");
      setRecoveryConfirmPass("");
      setSuperGateOpen(true);
      return;
    }
    setActiveProfile(targetId);
  }

  async function confirmSuperAdminSwitch() {
    if (!superGateTargetId) return;
    const code = passcode.trim();
    if (!code) {
      toast.error("Enter the super admin passcode.");
      return;
    }
    setSuperGateBusy(true);
    try {
      const db = await getDb();
      const ok = await verifySuperAdminPasscode(db, code);
      if (!ok) {
        toast.error("Passcode is incorrect.");
        return;
      }
      setActiveProfile(superGateTargetId);
      setSuperGateOpen(false);
      setSuperGateTargetId(null);
      setPasscode("");
      toast.success("Switched to super admin workspace.");
    } finally {
      setSuperGateBusy(false);
    }
  }

  async function confirmRecoveryResetAndUnlock() {
    if (!superGateTargetId) return;
    const rec = recoveryKeyInput.trim();
    const next = recoveryNewPass.trim();
    const confirm = recoveryConfirmPass.trim();
    if (!rec) {
      toast.error("Enter your recovery key.");
      return;
    }
    if (!next || next.length < 4) {
      toast.error("New passcode must be at least 4 characters.");
      return;
    }
    if (next !== confirm) {
      toast.error("New passcode and confirmation do not match.");
      return;
    }
    setSuperGateBusy(true);
    try {
      const db = await getDb();
      const res = await resetSuperAdminPasscodeWithRecovery(db, rec, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setActiveProfile(superGateTargetId);
      setSuperGateOpen(false);
      setSuperGateTargetId(null);
      setPasscode("");
      setSuperGateView("passcode");
      setRecoveryKeyInput("");
      setRecoveryNewPass("");
      setRecoveryConfirmPass("");
      toast.success(
        "Passcode reset. You’re in as super admin — replace the recovery key on Team if this device might be compromised.",
      );
    } finally {
      setSuperGateBusy(false);
    }
  }

  const superGateTargetName = React.useMemo(() => {
    if (!superGateTargetId) return "";
    const p = allProfiles.find((x) => x.id === superGateTargetId);
    return p?.displayName?.trim() || "Owner";
  }, [allProfiles, superGateTargetId]);

  return (
    <>
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
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {profile ? formatRoleLabel(profile.role) : "…"}
          </Badge>
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
                Workspace
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              <DropdownMenuLabel className="font-normal">
                <div className="text-xs text-muted-foreground">
                  Active profile
                </div>
                <div className="text-sm font-medium text-foreground">
                  {profile?.displayName?.trim() || "Staff"}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allProfiles.length > 1 ? (
                <>
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Switch profile
                  </DropdownMenuLabel>
                  {allProfiles.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      className="cursor-pointer gap-2"
                      onClick={() => beginSwitchToProfile(p.id, p.role)}
                    >
                      <Users className="size-4 shrink-0 opacity-70" />
                      <span className="min-w-0 truncate">
                        {p.displayName?.trim() || p.id.slice(0, 8)}
                        {p.role === ROLES.super_admin ? " · Super admin" : ""}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Dialog
        open={superGateOpen}
        onOpenChange={(open) => {
          setSuperGateOpen(open);
          if (!open) {
            setSuperGateTargetId(null);
            setPasscode("");
            setSuperGateView("passcode");
            setRecoveryKeyInput("");
            setRecoveryNewPass("");
            setRecoveryConfirmPass("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {superGateView === "passcode"
                ? "Super admin workspace"
                : "Reset passcode with recovery key"}
            </DialogTitle>
            <DialogDescription>
              {superGateView === "passcode" ? (
                <>
                  Enter the passcode to switch to{" "}
                  <span className="font-medium text-foreground">
                    {superGateTargetName}
                  </span>
                  . Change this passcode on the Team page when signed in as super
                  admin.
                </>
              ) : (
                <>
                  Enter the recovery key you saved from the Team page, then choose a
                  new super admin passcode (at least 4 characters).
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {superGateView === "passcode" ? (
            <>
              <div className="grid gap-2 py-2">
                <Label htmlFor="super-passcode">Passcode</Label>
                <Input
                  id="super-passcode"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void confirmSuperAdminSwitch();
                  }}
                />
              </div>
              <button
                type="button"
                className="text-left text-sm text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setSuperGateView("recovery");
                  setPasscode("");
                }}
              >
                Forgot passcode?
              </button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSuperGateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={superGateBusy}
                  onClick={() => void confirmSuperAdminSwitch()}
                >
                  {superGateBusy ? "Checking…" : "Unlock"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="super-recovery">Recovery key</Label>
                  <Input
                    id="super-recovery"
                    type="password"
                    autoComplete="off"
                    autoFocus
                    className="font-mono text-sm"
                    value={recoveryKeyInput}
                    onChange={(e) => setRecoveryKeyInput(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="super-new-pw">New passcode</Label>
                  <Input
                    id="super-new-pw"
                    type="password"
                    autoComplete="new-password"
                    value={recoveryNewPass}
                    onChange={(e) => setRecoveryNewPass(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="super-confirm-pw">Confirm new passcode</Label>
                  <Input
                    id="super-confirm-pw"
                    type="password"
                    autoComplete="new-password"
                    value={recoveryConfirmPass}
                    onChange={(e) => setRecoveryConfirmPass(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void confirmRecoveryResetAndUnlock();
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSuperGateView("passcode");
                    setRecoveryKeyInput("");
                    setRecoveryNewPass("");
                    setRecoveryConfirmPass("");
                  }}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  disabled={superGateBusy}
                  onClick={() => void confirmRecoveryResetAndUnlock()}
                >
                  {superGateBusy ? "Saving…" : "Reset & unlock"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
