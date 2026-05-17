/** Domain types (camelCase) matching prior Instant-backed UI shapes. */

export type Profile = {
  id: string;
  role: string;
  displayName?: string | null;
  createdAt: number;
};

export type Product = {
  id: string;
  name: string;
  barcode?: string | null;
  buyingPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  imageUrl?: string | null;
  createdAt: number;
};

export type Sale = {
  id: string;
  totalAmount: number;
  createdAt: number;
  note?: string | null;
  creator?: Profile | null;
  items?: SaleItem[];
};

export type SaleItem = {
  id: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  product?: Product | null;
};

export type StockMovement = {
  id: string;
  kind: string;
  quantityDelta: number;
  note?: string | null;
  createdAt: number;
  relatedSaleId?: string | null;
  product?: Product | null;
};

export type InstallmentPlan = {
  id: string;
  customerName: string;
  totalAmount: number;
  paidSoFar: number;
  notes?: string | null;
  createdAt: number;
  status: string;
  items?: InstallmentItem[];
};

export type InstallmentItem = {
  id: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  product?: Product | null;
};

export type CreditDebt = {
  id: string;
  customerName: string;
  quantity: number;
  unitPriceAtSale: number;
  totalOwed: number;
  paidSoFar: number;
  notes?: string | null;
  createdAt: number;
  status: string;
  product?: Product | null;
};
