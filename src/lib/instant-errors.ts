/**
 * Instant server actions often fail with opaque messages when the dashboard
 * schema is behind local `instant.schema.ts`, or when the server cannot reach
 * Instant's API (network / env).
 *
 * Use ASCII-only punctuation in returned strings so RSC / Flight serialization
 * does not show mojibake (e.g. em dash -> "â€"") in some clients.
 */
export function instantActionErrorMessage(error: unknown): string {
  const base =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown error";

  const causeMsg =
    error instanceof Error &&
    error.cause instanceof Error &&
    typeof error.cause.message === "string" &&
    error.cause.message.trim() !== ""
      ? error.cause.message.trim()
      : null;

  const msg = causeMsg ? `${base}. Cause: ${causeMsg}` : base;
  const lower = msg.toLowerCase();

  if (
    msg.includes("Attributes are missing in your schema") ||
    msg.includes("Validation failed for steps")
  ) {
    return `${msg} Push local schema and permissions: run \`npm run instant:push\` (after \`npx instant-cli login\`).`;
  }

  if (
    base === "fetch failed" ||
    lower.includes("fetch failed") ||
    lower.includes("networkerror") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("certificate") ||
    lower.includes("socket hang up")
  ) {
    return `${base} - Server could not reach InstantDB. Check: (1) \`.env.local\` has NEXT_PUBLIC_INSTANT_APP_ID and INSTANT_APP_ADMIN_TOKEN from https://instantdb.com/dash -> your app -> Auth / Admin; (2) no VPN or firewall blocking outbound HTTPS to api.instantdb.com; (3) restart \`npm run dev\` after editing env.${causeMsg ? ` Underlying: ${causeMsg}` : ""}`;
  }

  if (base === "Unauthorized") {
    return `${base} - Sign in again from /login. If this persists, confirm NEXT_PUBLIC_INSTANT_APP_ID matches your Instant app and POST /api/instant is reachable.`;
  }

  if (
    msg.includes("Missing NEXT_PUBLIC_INSTANT_APP_ID") ||
    msg.includes("INSTANT_APP_ADMIN_TOKEN")
  ) {
    return `${msg} Copy \`.env.example\` to \`.env.local\` and fill values from the Instant dashboard.`;
  }

  return msg;
}
