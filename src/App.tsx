import * as React from "react";
import { isTauri } from "@tauri-apps/api/core";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppProviders } from "@/providers/app-providers";
import { ShopSessionProvider, useShopSession } from "@/context/shop-session";
import { LoadingState } from "@/components/loading-state";
import { ShopShell } from "@/components/layout/shop-shell";
import { isAdminRole } from "@/lib/constants";
import { DashboardPage } from "@/pages/dashboard-page";
import { ProductsPage } from "@/pages/products-page";
import { SalesPage } from "@/pages/sales-page";
import { InstallmentsPage } from "@/pages/installments-page";
import { PayLaterPage } from "@/pages/pay-later-page";
import { InventoryPage } from "@/pages/inventory-page";
import { ReportsPage } from "@/pages/reports-page";
import { TeamPage } from "@/pages/team-page";

function BootGate({ children }: { children: React.ReactNode }) {
  const { ready, error } = useShopSession();

  if (error) {
    const insideDesktopApp = isTauri();
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">
          <p className="font-medium">Database unavailable</p>
          <p className="mt-2 text-sm opacity-90">{error}</p>
          {insideDesktopApp ? (
            <p className="mt-4 text-xs text-muted-foreground">
              The database should open inside this app. If this keeps happening, try reinstalling{" "}
              <strong className="text-foreground">Muna Shop</strong> or check that your disk isn&apos;t full.
              Note the technical message above if you need support.
            </p>
          ) : (
            <div className="mt-4 space-y-3 text-xs text-muted-foreground">
              <p className="text-foreground">
                You&apos;re viewing the web preview in a browser. The local SQLite database only runs in the{" "}
                <strong>Muna Shop</strong> desktop window, not in Safari or Chrome.
              </p>
              <p>
                <strong className="text-foreground">Developing:</strong> stop using this browser tab. In the{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">stock-shop</code> folder run{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
                  npm run tauri:dev
                </code>
                — that launches the real desktop app with SQLite.{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">npm run dev</code> alone is
                browser-only and cannot load Tauri plugins.
              </p>
              <p>
                <strong className="text-foreground">Daily use:</strong> open{" "}
                <strong className="text-foreground">Muna Shop</strong> from Applications (your installed{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">.app</code>), not localhost in a
                browser.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingState label="Opening local database…" />
      </div>
    );
  }

  return <>{children}</>;
}

function ShopLayoutRoute() {
  return (
    <ShopShell>
      <Outlet />
    </ShopShell>
  );
}

function RequireAdmin({ children }: { children: React.ReactElement }) {
  const { profile } = useShopSession();
  if (!isAdminRole(profile?.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<ShopLayoutRoute />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="installments" element={<InstallmentsPage />} />
        <Route path="pay-later" element={<PayLaterPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route
          path="reports"
          element={
            <RequireAdmin>
              <ReportsPage />
            </RequireAdmin>
          }
        />
        <Route path="team" element={<TeamPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <ShopSessionProvider>
          <BootGate>
            <AppRoutes />
          </BootGate>
        </ShopSessionProvider>
      </AppProviders>
    </BrowserRouter>
  );
}
