import { getUnverifiedUserFromInstantCookie } from "@instantdb/react/nextjs";

export async function getSessionUser() {
  const appId = process.env.NEXT_PUBLIC_INSTANT_APP_ID;
  if (!appId) return null;
  return getUnverifiedUserFromInstantCookie(appId);
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user?.id) {
    throw new Error("Unauthorized");
  }
  return user;
}
