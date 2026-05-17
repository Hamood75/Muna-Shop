import * as React from "react";
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
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">
          <p className="font-medium">Database unavailable</p>
          <p className="mt-2 text-sm opacity-90">{error}</p>
          <p className="mt-4 text-xs text-muted-foreground">
            Run{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
              npm run tauri:dev
            </code>{" "}
            so SQLite opens inside the desktop shell. Plain{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
              npm run dev
            </code>{" "}
            does not load Tauri plugins.
          </p>
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
