import * as React from "react";
import type { Profile } from "@/lib/entities";
import { ROLES } from "@/lib/constants";
import { initSqliteDatabase } from "@/lib/sqlite-db";
import { fetchProfileById, fetchProfiles } from "@/lib/queries";

const ACTIVE_KEY = "muna-shop-active-profile";

type ShopSessionState = {
  ready: boolean;
  error: string | null;
  profile: Profile | null;
  allProfiles: Profile[];
  reloadProfiles: () => Promise<void>;
  setActiveProfile: (id: string) => void;
};

const ShopSessionContext = React.createContext<ShopSessionState | null>(null);

export function ShopSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [allProfiles, setAllProfiles] = React.useState<Profile[]>([]);

  const reloadProfiles = React.useCallback(async () => {
    const list = await fetchProfiles();
    setAllProfiles(list);
    const stored = localStorage.getItem(ACTIVE_KEY);
    let next: Profile | null = null;
    if (stored) {
      next = list.find((p) => p.id === stored) ?? null;
    }
    if (!next) {
      next =
        list.find((p) => p.role === ROLES.super_admin) ??
        list[0] ??
        null;
      if (next) localStorage.setItem(ACTIVE_KEY, next.id);
    }
    setProfile(next);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initSqliteDatabase();
        if (cancelled) return;
        await reloadProfiles();
        if (cancelled) return;
        setReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadProfiles]);

  const setActiveProfile = React.useCallback((id: string) => {
    localStorage.setItem(ACTIVE_KEY, id);
    void (async () => {
      const p = await fetchProfileById(id);
      setProfile(p);
    })();
  }, []);

  const value = React.useMemo(
    (): ShopSessionState => ({
      ready,
      error,
      profile,
      allProfiles,
      reloadProfiles,
      setActiveProfile,
    }),
    [ready, error, profile, allProfiles, reloadProfiles, setActiveProfile],
  );

  return (
    <ShopSessionContext.Provider value={value}>
      {children}
    </ShopSessionContext.Provider>
  );
}

export function useShopSession() {
  const ctx = React.useContext(ShopSessionContext);
  if (!ctx) {
    throw new Error("useShopSession must be used within ShopSessionProvider");
  }
  return ctx;
}
