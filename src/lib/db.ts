import { init } from "@instantdb/react/nextjs";
import schema from "@/instant.schema";

/**
 * Instant validates app id as a UUID. CI / `next build` often runs without env;
 * a placeholder satisfies init during compilation. **Next inlines `NEXT_PUBLIC_*`
 * at build time** — production deploys must set `NEXT_PUBLIC_INSTANT_APP_ID`
 * before `next build`, then redeploy; otherwise the client sends the placeholder
 * and Instant rejects magic-code requests (e.g. 400 on send_magic_code).
 */
const INSTANT_APP_ID_BUILD_FALLBACK =
  "00000000-0000-4000-8000-000000000001";

export const INSTANT_APP_ID_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_INSTANT_APP_ID?.trim(),
);

export const db = init({
  appId:
    process.env.NEXT_PUBLIC_INSTANT_APP_ID?.trim() ||
    INSTANT_APP_ID_BUILD_FALLBACK,
  schema,
  useDateObjects: false,
  firstPartyPath: "/api/instant",
});
