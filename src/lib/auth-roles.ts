"use server";

import { ROLES } from "@/lib/constants";
import { getAdminDb } from "@/lib/admin-db";
import { requireSessionUser } from "@/lib/auth-server";

export async function requireSuperAdminProfile() {
  const user = await requireSessionUser();
  const db = getAdminDb();
  const res = await db.query({
    profiles: {
      $: { where: { "user.id": user.id } },
    },
  });
  const mine = res.profiles?.[0];
  if (!mine || mine.role !== ROLES.super_admin) {
    throw new Error("Forbidden");
  }
  return { user, profileId: mine.id };
}
