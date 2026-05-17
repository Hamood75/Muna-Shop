"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ROLES } from "@/lib/constants";
import { formatRoleLabel } from "@/lib/role-labels";
import { addTeamProfile, setMemberRole } from "@/lib/write";
import {
  fetchRecoveryKeyConfigured,
  fetchTeamMembers,
  type TeamMemberRow,
} from "@/lib/queries";
import { queryKeys } from "@/lib/query-keys";
import { getDb } from "@/lib/sqlite-db";
import {
  createOrReplaceRecoveryKey,
  DEFAULT_SUPER_ADMIN_PASSCODE,
  updateSuperAdminPasscode,
} from "@/lib/admin-passcode";
import { LoadingState } from "@/components/loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useShopSession } from "@/context/shop-session";

export function TeamClient() {
  const queryClient = useQueryClient();
  const { profile, reloadProfiles } = useShopSession();
  const [newName, setNewName] = React.useState("");
  const [newRole, setNewRole] = React.useState<
    typeof ROLES.admin | typeof ROLES.staff
  >(ROLES.staff);
  const [currentPasscode, setCurrentPasscode] = React.useState("");
  const [nextPasscode, setNextPasscode] = React.useState("");
  const [confirmPasscode, setConfirmPasscode] = React.useState("");
  const [passBusy, setPassBusy] = React.useState(false);
  const [recoveryGenPass, setRecoveryGenPass] = React.useState("");
  const [recoveryGenBusy, setRecoveryGenBusy] = React.useState(false);
  const [recoveryRevealOpen, setRecoveryRevealOpen] = React.useState(false);
  const [recoveryRevealPlain, setRecoveryRevealPlain] = React.useState<
    string | null
  >(null);

  const canManage = profile?.role === ROLES.super_admin;

  const teamQuery = useQuery({
    queryKey: queryKeys.team(),
    queryFn: async () => {
      const rows = await fetchTeamMembers();
      return rows;
    },
    enabled: !!canManage,
  });

  const recoveryStatusQuery = useQuery({
    queryKey: queryKeys.recoveryKeyStatus(),
    queryFn: fetchRecoveryKeyConfigured,
    enabled: !!canManage,
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const res = await addTeamProfile(newName, newRole);
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: async () => {
      toast.success("Team member added");
      setNewName("");
      void queryClient.invalidateQueries({ queryKey: queryKeys.team() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.root });
      await reloadProfiles();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const roleMut = useMutation({
    mutationFn: async ({
      profileId,
      role,
    }: {
      profileId: string;
      role: typeof ROLES.admin | typeof ROLES.staff;
    }) => {
      const res = await setMemberRole(profileId, role);
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: async () => {
      toast.success("Role updated");
      void queryClient.invalidateQueries({ queryKey: queryKeys.team() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.root });
      await reloadProfiles();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!profile) {
    return <LoadingState label="Loading workspace…" />;
  }

  if (!canManage) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
        Only the super admin can manage team profiles. The first profile created on this
        device is the owner (super admin).
      </div>
    );
  }

  if (teamQuery.isLoading) return <LoadingState />;

  if (teamQuery.error) {
    return (
      <div className="rounded-xl border border-destructive/40 p-4 text-destructive">
        {teamQuery.error.message}
      </div>
    );
  }

  const members = teamQuery.data ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Super admin passcode</CardTitle>
          <p className="text-sm text-muted-foreground">
            Anyone switching to the Owner / super admin profile from{" "}
            <strong>Workspace</strong> must enter this passcode. Default on a new
            database is{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {DEFAULT_SUPER_ADMIN_PASSCODE}
            </code>{" "}
            — change it here as soon as you can.
          </p>
        </CardHeader>
        <CardContent className="grid max-w-md gap-4">
          <div className="grid gap-2">
            <Label htmlFor="pass-current">Current passcode</Label>
            <Input
              id="pass-current"
              type="password"
              autoComplete="current-password"
              value={currentPasscode}
              onChange={(e) => setCurrentPasscode(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pass-new">New passcode</Label>
            <Input
              id="pass-new"
              type="password"
              autoComplete="new-password"
              value={nextPasscode}
              onChange={(e) => setNextPasscode(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pass-confirm">Confirm new passcode</Label>
            <Input
              id="pass-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPasscode}
              onChange={(e) => setConfirmPasscode(e.target.value)}
            />
          </div>
          <Button
            type="button"
            disabled={
              passBusy ||
              !currentPasscode.trim() ||
              !nextPasscode.trim() ||
              !confirmPasscode.trim()
            }
            onClick={async () => {
              if (nextPasscode.trim() !== confirmPasscode.trim()) {
                toast.error("New passcode and confirmation do not match.");
                return;
              }
              setPassBusy(true);
              try {
                const db = await getDb();
                const res = await updateSuperAdminPasscode(
                  db,
                  currentPasscode.trim(),
                  nextPasscode.trim(),
                );
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                toast.success("Super admin passcode updated.");
                setCurrentPasscode("");
                setNextPasscode("");
                setConfirmPasscode("");
              } finally {
                setPassBusy(false);
              }
            }}
          >
            {passBusy ? "Saving…" : "Update passcode"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recovery key (forgot passcode)</CardTitle>
          <p className="text-sm text-muted-foreground">
            If you forget the super admin passcode, you can set a new one from the
            Workspace unlock screen using this one-time recovery key. Generate it while
            you still know the passcode and store it somewhere safe (password manager /
            sealed paper). Replacing the key invalidates the previous one. This app is
            fully offline — if you lose both the passcode and recovery key, there is no
            cloud reset; keep a backup of your database file if needed.
          </p>
        </CardHeader>
        <CardContent className="grid max-w-md gap-4">
          <p className="text-sm font-medium text-foreground">
            Recovery key:{" "}
            {recoveryStatusQuery.isLoading ? (
              <span className="font-normal text-muted-foreground">…</span>
            ) : recoveryStatusQuery.data ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                configured
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">
                not set yet
              </span>
            )}
          </p>
          <div className="grid gap-2">
            <Label htmlFor="recovery-pass">Current passcode (to prove it is you)</Label>
            <Input
              id="recovery-pass"
              type="password"
              autoComplete="current-password"
              value={recoveryGenPass}
              onChange={(e) => setRecoveryGenPass(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={
              recoveryGenBusy || !recoveryGenPass.trim() || recoveryStatusQuery.isLoading
            }
            onClick={async () => {
              setRecoveryGenBusy(true);
              try {
                const db = await getDb();
                const res = await createOrReplaceRecoveryKey(
                  db,
                  recoveryGenPass.trim(),
                );
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                setRecoveryGenPass("");
                setRecoveryRevealPlain(res.recovery);
                setRecoveryRevealOpen(true);
                void queryClient.invalidateQueries({
                  queryKey: queryKeys.recoveryKeyStatus(),
                });
                toast.success("Recovery key created. Copy it now — it won’t show again.");
              } finally {
                setRecoveryGenBusy(false);
              }
            }}
          >
            {recoveryGenBusy
              ? "Generating…"
              : recoveryStatusQuery.data
                ? "Replace recovery key"
                : "Generate recovery key"}
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={recoveryRevealOpen}
        onOpenChange={(open) => {
          setRecoveryRevealOpen(open);
          if (!open) setRecoveryRevealPlain(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Save your recovery key</DialogTitle>
            <DialogDescription>
              This is shown only once. Copy it and store it somewhere safe before closing.
            </DialogDescription>
          </DialogHeader>
          {recoveryRevealPlain ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <p className="break-all font-mono text-sm tracking-tight">
                  {recoveryRevealPlain}
                </p>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(recoveryRevealPlain);
                      toast.success("Copied to clipboard.");
                    } catch {
                      toast.error("Could not copy — select and copy manually.");
                    }
                  }}
                >
                  Copy
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setRecoveryRevealOpen(false);
                    setRecoveryRevealPlain(null);
                  }}
                >
                  I saved this
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add team member</CardTitle>
          <p className="text-sm text-muted-foreground">
            Create a local profile for someone who uses this computer. Switch between
            profiles from the <strong>Workspace</strong> menu. Switching to the
            Owner profile requires the super admin passcode (see above).
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="new-member-name">Display name</Label>
            <Input
              id="new-member-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Counter staff"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-member-role">Role</Label>
            <select
              id="new-member-role"
              className="flex h-11 rounded-lg border border-border bg-background px-3 text-sm"
              value={newRole}
              onChange={(e) =>
                setNewRole(e.target.value as typeof ROLES.admin | typeof ROLES.staff)
              }
            >
              <option value={ROLES.staff}>{formatRoleLabel(ROLES.staff)}</option>
              <option value={ROLES.admin}>{formatRoleLabel(ROLES.admin)}</option>
            </select>
          </div>
          <Button
            type="button"
            disabled={addMut.isPending || !newName.trim()}
            onClick={() => addMut.mutate()}
          >
            Add member
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team & roles</CardTitle>
          <p className="text-sm text-muted-foreground">
            Assign <strong>Admin</strong> or <strong>Staff</strong> to local profiles.
            The super admin (Owner) is created automatically on first launch.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-3 pr-4 font-medium">Display name</th>
                <th className="py-3 pr-4 font-medium">Role</th>
                <th className="py-3 font-medium">Change role</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m: TeamMemberRow) => {
                const isSuper = m.role === ROLES.super_admin;
                const selectValue =
                  m.role === ROLES.admin ? ROLES.admin : ROLES.staff;

                return (
                  <tr key={m.profileId} className="border-b border-border/70">
                    <td className="py-3 pr-4 align-middle">
                      {m.displayName ?? "—"}
                    </td>
                    <td className="py-3 pr-4 align-middle">
                      {formatRoleLabel(m.role)}
                    </td>
                    <td className="py-3 align-middle">
                      {isSuper ? (
                        <span className="text-xs text-muted-foreground">
                          Super admin
                        </span>
                      ) : (
                        <>
                          <Label htmlFor={`role-${m.profileId}`} className="sr-only">
                            Role for {m.displayName}
                          </Label>
                          <select
                            id={`role-${m.profileId}`}
                            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                            disabled={roleMut.isPending}
                            value={selectValue}
                            onChange={(e) =>
                              roleMut.mutate({
                                profileId: m.profileId,
                                role: e.target.value as
                                  | typeof ROLES.admin
                                  | typeof ROLES.staff,
                              })
                            }
                          >
                            <option value={ROLES.admin}>
                              {formatRoleLabel(ROLES.admin)}
                            </option>
                            <option value={ROLES.staff}>
                              {formatRoleLabel(ROLES.staff)}
                            </option>
                          </select>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {members.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No profiles found.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
