import { createInstantRouteHandler } from "@instantdb/react/nextjs";

let handlerCache:
  | ReturnType<typeof createInstantRouteHandler>
  | null
  | undefined;

function getHandler():
  | ReturnType<typeof createInstantRouteHandler>
  | null {
  const appId = process.env.NEXT_PUBLIC_INSTANT_APP_ID?.trim();
  if (!appId) return null;
  if (handlerCache === undefined) {
    handlerCache = createInstantRouteHandler({ appId });
  }
  return handlerCache;
}

export async function POST(req: Request) {
  const handler = getHandler();
  if (!handler) {
    return Response.json(
      {
        error:
          "NEXT_PUBLIC_INSTANT_APP_ID is not set. Add it to .env.local for dev or to your host’s environment (e.g. Vercel Project Settings → Environment Variables), then redeploy.",
      },
      { status: 503 },
    );
  }
  return handler.POST(req);
}
