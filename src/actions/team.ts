"use server";

import { ROLES } from "@/lib/constants";
import type { ActionResult } from "@/actions/profile";
import { getAdminDb } from "@/lib/admin-db";
import { requireSuperAdminProfile } from "@/lib/auth-roles";
import { instantActionErrorMessage } from "@/lib/instant-errors";
import { setMemberRoleSchema } from "@/lib/validations/team";

export type TeamMemberRow = {
  profileId: string;
  email: string;
  displayName: string | undefined;
  role: string;
};

export async function getTeamMembersAction(): Promise<
  ActionResult<TeamMemberRow[]>
> {
  try {
    await requireSuperAdminProfile();
    const db = getAdminDb();
    const res = await db.query({
      profiles: {
        user: {},
      },
    });

    const rows: TeamMemberRow[] = (res.profiles ?? []).map((p) => {
      const u = p.user as { email?: string } | undefined;
      return {
        profileId: p.id,
        email: u?.email ?? "",
        displayName: p.displayName ?? undefined,
        role: p.role,
      };
    });

    rows.sort((a, b) => a.email.localeCompare(b.email));

    return { ok: true, data: rows };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error && e.message === "Forbidden"
          ? "Only the super admin can manage team members."
          : instantActionErrorMessage(e),
    };
  }
}

export async function setMemberRoleAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const { profileId, role } = setMemberRoleSchema.parse(input);
    await requireSuperAdminProfile();
    const db = getAdminDb();

    const targetRes = await db.query({
      profiles: {
        $: { where: { id: profileId } },
      },
    });
    const target = targetRes.profiles?.[0];
    if (!target) throw new Error("Profile not found");

    if (target.role === ROLES.super_admin) {
      throw new Error("Super admin role cannot be changed here.");
    }

    if (role === target.role) {
      return { ok: true };
    }

    await db.transact([db.tx.profiles[profileId].update({ role })]);

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error && e.message === "Forbidden"
          ? "Only the super admin can change roles."
          : instantActionErrorMessage(e),
    };
  }
}
