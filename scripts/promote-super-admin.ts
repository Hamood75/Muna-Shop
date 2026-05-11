/**
 * One-off: set a profile's role to super_admin.
 * Pass an Instant $users id OR a profiles row id.
 *
 * Usage (from stock-shop root):
 *   npx tsx scripts/promote-super-admin.ts <uuid>
 *
 * Loads `.env.local` then `.env` if present (does not override existing env).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { init } from "@instantdb/admin";
import schema from "../src/instant.schema";
import { ROLES } from "../src/lib/constants";

function loadDotEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

loadDotEnvFiles();

const idArg = process.argv[2]?.trim();
if (!idArg) {
  console.error("Usage: npx tsx scripts/promote-super-admin.ts <user-or-profile-uuid>");
  process.exit(1);
}

const appId =
  process.env.NEXT_PUBLIC_INSTANT_APP_ID?.trim() ??
  process.env.INSTANT_APP_ID?.trim();
const adminToken = process.env.INSTANT_APP_ADMIN_TOKEN?.trim();

if (!appId || !adminToken) {
  console.error(
    "Missing NEXT_PUBLIC_INSTANT_APP_ID or INSTANT_APP_ADMIN_TOKEN in the environment.",
  );
  process.exit(1);
}

const db = init({
  appId,
  adminToken,
  schema,
  useDateObjects: false,
});

async function main() {
  const byProfileId = await db.query({
    profiles: { $: { where: { id: idArg } } },
  });
  let profileId = byProfileId.profiles?.[0]?.id;

  if (!profileId) {
    const byUserId = await db.query({
      profiles: { $: { where: { "user.id": idArg } } },
    });
    profileId = byUserId.profiles?.[0]?.id;
  }

  if (!profileId) {
    console.error(
      `No profile found for id=${idArg} (tried profiles.id and profiles.user.id).`,
    );
    process.exit(1);
  }

  await db.transact([
    db.tx.profiles[profileId].update({ role: ROLES.super_admin }),
  ]);
  console.log(`Updated profiles/${profileId} → role super_admin`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
