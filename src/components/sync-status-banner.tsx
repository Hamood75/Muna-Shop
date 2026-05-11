"use client";

import * as React from "react";
import { db } from "@/lib/db";

export function SyncStatusBanner() {
  const instantStatus = db.useConnectionStatus();
  const [online, setOnline] = React.useState(true);

  React.useEffect(() => {
    const sync = () => setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const instantDisconnected =
    instantStatus === "closed" || instantStatus === "errored";

  if (online && !instantDisconnected) return null;

  return (
    <div
      role="status"
      className="border-b border-border bg-muted/80 px-4 py-2 text-center text-sm text-muted-foreground"
    >
      {online ? (
        <>
          Reconnecting to sync server… You can keep working; changes queue in this
          device until the connection is back.
        </>
      ) : (
        <>
          Offline mode: catalog and recent data stay available. Sales and stock
          changes save on this device and sync automatically when you are online
          again.
        </>
      )}
    </div>
  );
}
