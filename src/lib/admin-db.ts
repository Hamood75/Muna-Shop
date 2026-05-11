import { init } from "@instantdb/admin";
import schema from "@/instant.schema";

export function getAdminDb() {
  const appId =
    process.env.NEXT_PUBLIC_INSTANT_APP_ID ?? process.env.INSTANT_APP_ID;
  const adminToken = process.env.INSTANT_APP_ADMIN_TOKEN;
  if (!appId) {
    throw new Error("Missing NEXT_PUBLIC_INSTANT_APP_ID (server sees no app id)");
  }
  if (!adminToken) {
    throw new Error(
      "Missing INSTANT_APP_ADMIN_TOKEN — add it in Vercel → Settings → Environment Variables (Production), then redeploy",
    );
  }
  return init({
    appId,
    adminToken,
    schema,
    useDateObjects: false,
  });
}
