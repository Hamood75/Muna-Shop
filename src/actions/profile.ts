"use server";

import { id } from "@instantdb/admin";
import { ROLES } from "@/lib/constants";
import { getAdminDb } from "@/lib/admin-db";
import { instantActionErrorMessage } from "@/lib/instant-errors";
import { requireSessionUser } from "@/lib/auth-server";
import { isSuperAdminEmail } from "@/lib/super-admin";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function ensureProfileAction(): Promise<ActionResult<{ role: string }>> {
  try {
    const user = await requireSessionUser();
    const db = getAdminDb();

    const existing = await db.query({
      profiles: {
        $: { where: { "user.id": user.id } },
      },
    });

    const mine = existing.profiles?.[0];
    if (mine) {
      if (
        isSuperAdminEmail(user.email) &&
        mine.role !== ROLES.super_admin
      ) {
        await db.transact([
          db.tx.profiles[mine.id].update({ role: ROLES.super_admin }),
        ]);
        return { ok: true, data: { role: ROLES.super_admin } };
      }
      return { ok: true, data: { role: mine.role } };
    }

    const role = isSuperAdminEmail(user.email)
      ? ROLES.super_admin
      : ROLES.staff;

    const profileId = id();
    await db.transact([
      db.tx.profiles[profileId].update({
        role,
        createdAt: Date.now(),
        displayName: user.email ?? "Staff",
      }),
      db.tx.profiles[profileId].link({ user: user.id }),
    ]);

    return { ok: true, data: { role } };
  } catch (e) {
    return { ok: false, error: instantActionErrorMessage(e) };
  }
}
