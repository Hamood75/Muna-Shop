import { init } from "@instantdb/admin";
import schema from "@/instant.schema";

export function getAdminDb() {
  const appId =
    process.env.NEXT_PUBLIC_INSTANT_APP_ID ?? process.env.INSTANT_APP_ID;
  const adminToken = process.env.INSTANT_APP_ADMIN_TOKEN;
  if (!appId || !adminToken) {
    throw new Error(
      "Missing NEXT_PUBLIC_INSTANT_APP_ID or INSTANT_APP_ADMIN_TOKEN",
    );
  }
  return init({
    appId,
    adminToken,
    schema,
    useDateObjects: false,
  });
}
