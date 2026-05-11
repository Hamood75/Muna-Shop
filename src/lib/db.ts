import { init } from "@instantdb/react/nextjs";
import schema from "@/instant.schema";

/**
 * Instant validates app id as a UUID. CI / `next build` often runs without env;
 * a placeholder satisfies init during compilation. Production traffic still needs
 * `NEXT_PUBLIC_INSTANT_APP_ID` set on the host or the client cannot reach your app.
 */
const INSTANT_APP_ID_BUILD_FALLBACK =
  "00000000-0000-4000-8000-000000000001";

export const db = init({
  appId:
    process.env.NEXT_PUBLIC_INSTANT_APP_ID?.trim() ||
    INSTANT_APP_ID_BUILD_FALLBACK,
  schema,
  useDateObjects: false,
  firstPartyPath: "/api/instant",
});
