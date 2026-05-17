import type Database from "@tauri-apps/plugin-sql";

/** Bumped if hash algorithm changes (forces no silent mismatch with old rows). */
const PASSCODE_PEPPER = "muna-shop:v1:super-admin-passcode";

const RECOVERY_PEPPER = "muna-shop:v1:super-admin-recovery";

export const SUPER_ADMIN_PASSCODE_SETTINGS_KEY = "super_admin_passcode_hash";

export const SUPER_ADMIN_RECOVERY_SETTINGS_KEY = "super_admin_recovery_hash";

/** Set on new databases and when row missing (change on Team page). */
export const DEFAULT_SUPER_ADMIN_PASSCODE = "000000";

export async function hashSuperAdminPasscode(plain: string): Promise<string> {
  const payload = new TextEncoder().encode(`${PASSCODE_PEPPER}:${plain}`);
  const buf = await crypto.subtle.digest("SHA-256", payload);
  return Array.from(new Uint8Array(buf), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export async function hashRecoveryKey(plain: string): Promise<string> {
  const payload = new TextEncoder().encode(
    `${RECOVERY_PEPPER}:${plain.trim()}`,
  );
  const buf = await crypto.subtle.digest("SHA-256", payload);
  return Array.from(new Uint8Array(buf), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** URL-safe random token; store only the hash on disk. */
export function generateRecoveryToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!);
  }
  return btoa(bin)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

export async function ensureSuperAdminPasscodeDefaults(
  db: Database,
): Promise<void> {
  const rows = await db.select<{ v: string }[]>(
    "SELECT value AS v FROM app_settings WHERE key = ? LIMIT 1",
    [SUPER_ADMIN_PASSCODE_SETTINGS_KEY],
  );
  if (rows.length > 0) return;
  const hash = await hashSuperAdminPasscode(DEFAULT_SUPER_ADMIN_PASSCODE);
  await db.execute(
    "INSERT INTO app_settings (key, value) VALUES (?, ?)",
    [SUPER_ADMIN_PASSCODE_SETTINGS_KEY, hash],
  );
}

export async function hasRecoveryKey(db: Database): Promise<boolean> {
  const rows = await db.select<{ v: string }[]>(
    "SELECT value AS v FROM app_settings WHERE key = ? LIMIT 1",
    [SUPER_ADMIN_RECOVERY_SETTINGS_KEY],
  );
  return Boolean(rows[0]?.v?.length);
}

async function saveRecoveryKeyHash(
  db: Database,
  hash: string,
): Promise<void> {
  const rows = await db.select<{ c: number }[]>(
    "SELECT COUNT(*) AS c FROM app_settings WHERE key = ?",
    [SUPER_ADMIN_RECOVERY_SETTINGS_KEY],
  );
  if ((rows[0]?.c ?? 0) > 0) {
    await db.execute(
      "UPDATE app_settings SET value = ? WHERE key = ?",
      [hash, SUPER_ADMIN_RECOVERY_SETTINGS_KEY],
    );
  } else {
    await db.execute(
      "INSERT INTO app_settings (key, value) VALUES (?, ?)",
      [SUPER_ADMIN_RECOVERY_SETTINGS_KEY, hash],
    );
  }
}

export async function verifySuperAdminPasscode(
  db: Database,
  plain: string,
): Promise<boolean> {
  const rows = await db.select<{ v: string }[]>(
    "SELECT value AS v FROM app_settings WHERE key = ? LIMIT 1",
    [SUPER_ADMIN_PASSCODE_SETTINGS_KEY],
  );
  if (!rows[0]?.v) return false;
  const h = await hashSuperAdminPasscode(plain);
  return h === rows[0].v;
}

export async function verifyRecoveryKey(
  db: Database,
  plain: string,
): Promise<boolean> {
  const rows = await db.select<{ v: string }[]>(
    "SELECT value AS v FROM app_settings WHERE key = ? LIMIT 1",
    [SUPER_ADMIN_RECOVERY_SETTINGS_KEY],
  );
  if (!rows[0]?.v) return false;
  const h = await hashRecoveryKey(plain);
  return h === rows[0].v;
}

/** Create or replace recovery key; caller must prove super admin with current passcode. */
export async function createOrReplaceRecoveryKey(
  db: Database,
  passcodePlain: string,
): Promise<
  { ok: true; recovery: string } | { ok: false; error: string }
> {
  if (!(await verifySuperAdminPasscode(db, passcodePlain))) {
    return { ok: false, error: "Current passcode is incorrect." };
  }
  const recovery = generateRecoveryToken();
  const hash = await hashRecoveryKey(recovery);
  await saveRecoveryKeyHash(db, hash);
  return { ok: true, recovery };
}

export async function updateSuperAdminPasscode(
  db: Database,
  currentPlain: string,
  newPlain: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = newPlain.trim();
  if (trimmed.length < 4) {
    return { ok: false, error: "New passcode must be at least 4 characters." };
  }
  if (!(await verifySuperAdminPasscode(db, currentPlain))) {
    return { ok: false, error: "Current passcode is incorrect." };
  }
  const hash = await hashSuperAdminPasscode(trimmed);
  await db.execute(
    "UPDATE app_settings SET value = ? WHERE key = ?",
    [hash, SUPER_ADMIN_PASSCODE_SETTINGS_KEY],
  );
  return { ok: true };
}

/**
 * Forgot passcode: proves possession of recovery key and sets a new super admin passcode.
 * Does not rotate the recovery key (replace it on the Team page if this device may be compromised).
 */
export async function resetSuperAdminPasscodeWithRecovery(
  db: Database,
  recoveryPlain: string,
  newPlain: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = newPlain.trim();
  if (trimmed.length < 4) {
    return { ok: false, error: "New passcode must be at least 4 characters." };
  }
  if (!(await verifyRecoveryKey(db, recoveryPlain))) {
    return {
      ok: false,
      error:
        "Recovery key is wrong or no key was set yet. Ask a super admin to create one on Team.",
    };
  }
  const hash = await hashSuperAdminPasscode(trimmed);
  await db.execute(
    "UPDATE app_settings SET value = ? WHERE key = ?",
    [hash, SUPER_ADMIN_PASSCODE_SETTINGS_KEY],
  );
  return { ok: true };
}
