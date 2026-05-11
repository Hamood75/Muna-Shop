"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { formatRoleLabel } from "@/lib/role-labels";
import {
  getTeamMembersAction,
  setMemberRoleAction,
  type TeamMemberRow,
} from "@/actions/team";
import { LoadingState } from "@/components/loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function TeamClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = db.useAuth();

  const { data: profileData, isLoading: profileLoading } = db.useQuery(
    user?.id
      ? {
          profiles: {
            $: { where: { "user.id": user.id } },
          },
        }
      : null,
  );

  const myRole = profileData?.profiles?.[0]?.role;
  const canManage = myRole === ROLES.super_admin;

  React.useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user?.id) {
      router.replace("/login");
      return;
    }
    if (myRole && myRole !== ROLES.super_admin) {
      router.replace("/dashboard");
    }
  }, [authLoading, profileLoading, user?.id, myRole, router]);

  const teamQuery = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const res = await getTeamMembersAction();
      if (!res.ok) throw new Error(res.error);
      return res.data ?? [];
    },
    enabled: !!canManage,
  });

  const roleMut = useMutation({
    mutationFn: async ({
      profileId,
      role,
    }: {
      profileId: string;
      role: typeof ROLES.admin | typeof ROLES.staff;
    }) => {
      const res = await setMemberRoleAction({ profileId, role });
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () => {
      toast.success("Role updated");
      void queryClient.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (authLoading || profileLoading || !user?.id || !myRole) {
    return <LoadingState label="Checking access…" />;
  }

  if (!canManage) {
    return <LoadingState label="Redirecting…" />;
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
          <CardTitle className="text-lg">Team & roles</CardTitle>
          <p className="text-sm text-muted-foreground">
            Assign <strong>Admin</strong> or <strong>Staff</strong> to teammates.
            The super admin account is controlled with{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              SUPER_ADMIN_EMAIL
            </code>{" "}
            on the server (see{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              .env.example
            </code>
            ).
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-3 pr-4 font-medium">Email</th>
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
                      {m.email || "—"}
                    </td>
                    <td className="py-3 pr-4 align-middle text-muted-foreground">
                      {m.displayName ?? "—"}
                    </td>
                    <td className="py-3 pr-4 align-middle">
                      {formatRoleLabel(m.role)}
                    </td>
                    <td className="py-3 align-middle">
                      {isSuper ? (
                        <span className="text-xs text-muted-foreground">
                          Set via SUPER_ADMIN_EMAIL
                        </span>
                      ) : (
                        <>
                          <Label htmlFor={`role-${m.profileId}`} className="sr-only">
                            Role for {m.email}
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
              No profiles yet. Users appear here after they sign in once.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
