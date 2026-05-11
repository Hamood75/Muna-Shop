import { createInstantRouteHandler } from "@instantdb/react/nextjs";

const appId = process.env.NEXT_PUBLIC_INSTANT_APP_ID;
if (!appId) {
  throw new Error("NEXT_PUBLIC_INSTANT_APP_ID is required");
}

const handler = createInstantRouteHandler({ appId });

export const POST = handler.POST;
