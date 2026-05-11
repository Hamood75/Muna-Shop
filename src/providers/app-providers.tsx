"use client";

import * as React from "react";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryProviders } from "@/providers/query-provider";
import { Toaster } from "sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProviders>
        {children}
        <Toaster richColors position="top-center" />
      </QueryProviders>
    </ThemeProvider>
  );
}
