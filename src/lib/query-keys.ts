export const queryKeys = {
  root: ["muna-local"] as const,
  dashboard: () => [...queryKeys.root, "dashboard"] as const,
  products: (page: number, search: string) =>
    [...queryKeys.root, "products", page, search] as const,
  inventory: (page: number) => [...queryKeys.root, "inventory", page] as const,
  sales: () => [...queryKeys.root, "sales"] as const,
  reports: () => [...queryKeys.root, "reports"] as const,
  installments: () => [...queryKeys.root, "installments"] as const,
  payLater: () => [...queryKeys.root, "payLater"] as const,
  team: () => [...queryKeys.root, "team"] as const,
  recoveryKeyStatus: () => [...queryKeys.root, "recoveryKey"] as const,
};
