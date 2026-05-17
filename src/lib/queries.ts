import type {
  CreditDebt,
  InstallmentItem,
  InstallmentPlan,
  Product,
  Profile,
  Sale,
  SaleItem,
  StockMovement,
} from "@/lib/entities";
import { getDb } from "@/lib/sqlite-db";
import { hasRecoveryKey } from "@/lib/admin-passcode";
import { PRODUCTS_PAGE_SIZE } from "@/lib/constants";

type ProductRow = {
  id: string;
  name: string;
  barcode: string | null;
  buying_price: number;
  selling_price: number;
  stock_quantity: number;
  image_url: string | null;
  created_at: number;
};

type ProfileRow = {
  id: string;
  role: string;
  display_name: string | null;
  created_at: number;
};

export function mapProduct(r: ProductRow): Product {
  return {
    id: r.id,
    name: r.name,
    barcode: r.barcode,
    buyingPrice: r.buying_price,
    sellingPrice: r.selling_price,
    stockQuantity: r.stock_quantity,
    imageUrl: r.image_url,
    createdAt: r.created_at,
  };
}

export function mapProfile(r: ProfileRow): Profile {
  return {
    id: r.id,
    role: r.role,
    displayName: r.display_name,
    createdAt: r.created_at,
  };
}

export async function fetchProfileById(id: string): Promise<Profile | null> {
  const db = await getDb();
  const rows = await db.select<ProfileRow[]>(
    "SELECT id, role, display_name, created_at FROM profiles WHERE id = ? LIMIT 1",
    [id],
  );
  const r = rows[0];
  return r ? mapProfile(r) : null;
}

export async function fetchProfiles(): Promise<Profile[]> {
  const db = await getDb();
  const rows = await db.select<ProfileRow[]>(
    "SELECT id, role, display_name, created_at FROM profiles ORDER BY created_at ASC",
  );
  return rows.map(mapProfile);
}

export async function fetchAllProducts(): Promise<Product[]> {
  const db = await getDb();
  const rows = await db.select<ProductRow[]>(
    "SELECT * FROM products ORDER BY created_at DESC",
  );
  return rows.map(mapProduct);
}

export type ProductsPageResult = {
  items: Product[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export async function fetchProductsPage(
  page: number,
  search: string,
): Promise<ProductsPageResult> {
  const db = await getDb();
  const limit = PRODUCTS_PAGE_SIZE;
  const offset = page * limit;
  const term = search.trim();
  let rows: ProductRow[];

  if (!term) {
    rows = await db.select<ProductRow[]>(
      `SELECT * FROM products ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit + 1, offset],
    );
  } else {
    const pat = `%${term}%`;
    rows = await db.select<ProductRow[]>(
      `SELECT * FROM products
       WHERE LOWER(name) LIKE LOWER(?) OR (barcode IS NOT NULL AND LOWER(barcode) LIKE LOWER(?))
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [pat, pat, limit + 1, offset],
    );
  }

  const hasNextPage = rows.length > limit;
  const slice = hasNextPage ? rows.slice(0, limit) : rows;
  const hasPreviousPage = page > 0;

  return {
    items: slice.map(mapProduct),
    hasNextPage,
    hasPreviousPage,
  };
}

async function productMapByIds(ids: string[]): Promise<Map<string, Product>> {
  const unique = [...new Set(ids)].filter(Boolean);
  const m = new Map<string, Product>();
  if (unique.length === 0) return m;
  const db = await getDb();
  const placeholders = unique.map(() => "?").join(",");
  const rows = await db.select<ProductRow[]>(
    `SELECT * FROM products WHERE id IN (${placeholders})`,
    unique,
  );
  for (const r of rows) m.set(r.id, mapProduct(r));
  return m;
}

export async function fetchSalesBundle(): Promise<Sale[]> {
  const db = await getDb();
  const saleRows = await db.select<
    {
      id: string;
      total_amount: number;
      created_at: number;
      note: string | null;
      creator_id: string | null;
    }[]
  >("SELECT id, total_amount, created_at, note, creator_id FROM sales ORDER BY created_at DESC");

  const itemRows = await db.select<
    {
      id: string;
      sale_id: string;
      product_id: string;
      quantity: number;
      unit_price: number;
      line_total: number;
    }[]
  >("SELECT id, sale_id, product_id, quantity, unit_price, line_total FROM sale_items");

  const creatorIds = [
    ...new Set(saleRows.map((s) => s.creator_id).filter(Boolean)),
  ] as string[];
  const creators = new Map<string, Profile>();
  if (creatorIds.length) {
    const ph = creatorIds.map(() => "?").join(",");
    const pr = await db.select<ProfileRow[]>(
      `SELECT id, role, display_name, created_at FROM profiles WHERE id IN (${ph})`,
      creatorIds,
    );
    for (const row of pr) creators.set(row.id, mapProfile(row));
  }

  const productIds = [...new Set(itemRows.map((i) => i.product_id))];
  const products = await productMapByIds(productIds);

  const itemsBySale = new Map<string, SaleItem[]>();
  for (const i of itemRows) {
    const item: SaleItem = {
      id: i.id,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      lineTotal: i.line_total,
      product: products.get(i.product_id) ?? null,
    };
    const list = itemsBySale.get(i.sale_id) ?? [];
    list.push(item);
    itemsBySale.set(i.sale_id, list);
  }

  return saleRows.map((s) => ({
    id: s.id,
    totalAmount: s.total_amount,
    createdAt: s.created_at,
    note: s.note,
    creator: s.creator_id ? creators.get(s.creator_id) ?? null : null,
    items: itemsBySale.get(s.id) ?? [],
  }));
}

export async function fetchStockMovementsPage(
  page: number,
  pageSize: number,
): Promise<{
  movements: StockMovement[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}> {
  const db = await getDb();
  const offset = page * pageSize;
  const rows = await db.select<
    {
      id: string;
      product_id: string;
      kind: string;
      quantity_delta: number;
      note: string | null;
      created_at: number;
      related_sale_id: string | null;
    }[]
  >(
    `SELECT id, product_id, kind, quantity_delta, note, created_at, related_sale_id
     FROM stock_movements ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [pageSize + 1, offset],
  );
  const hasNextPage = rows.length > pageSize;
  const slice = hasNextPage ? rows.slice(0, pageSize) : rows;
  const pids = [...new Set(slice.map((r) => r.product_id))];
  const pmap = await productMapByIds(pids);

  const movements: StockMovement[] = slice.map((r) => ({
    id: r.id,
    kind: r.kind,
    quantityDelta: r.quantity_delta,
    note: r.note,
    createdAt: r.created_at,
    relatedSaleId: r.related_sale_id,
    product: pmap.get(r.product_id) ?? null,
  }));

  return {
    movements,
    hasNextPage,
    hasPreviousPage: page > 0,
  };
}

export async function fetchDashboardBundle(): Promise<{
  products: Product[];
  sales: Sale[];
  stockMovements: StockMovement[];
}> {
  const [products, sales, movRows] = await Promise.all([
    fetchAllProducts(),
    fetchSalesBundle(),
    (async () => {
      const db = await getDb();
      return db.select<
        {
          id: string;
          product_id: string;
          kind: string;
          quantity_delta: number;
          note: string | null;
          created_at: number;
          related_sale_id: string | null;
        }[]
      >(
        `SELECT id, product_id, kind, quantity_delta, note, created_at, related_sale_id
         FROM stock_movements ORDER BY created_at DESC`,
      );
    })(),
  ]);

  const pmap = new Map(products.map((p) => [p.id, p]));
  const stockMovements: StockMovement[] = movRows.map((r) => ({
    id: r.id,
    kind: r.kind,
    quantityDelta: r.quantity_delta,
    note: r.note,
    createdAt: r.created_at,
    relatedSaleId: r.related_sale_id,
    product: pmap.get(r.product_id) ?? null,
  }));

  return { products, sales, stockMovements };
}

export async function fetchInstallmentsBundle(): Promise<InstallmentPlan[]> {
  const db = await getDb();
  const plans = await db.select<
    {
      id: string;
      customer_name: string;
      total_amount: number;
      paid_so_far: number;
      notes: string | null;
      created_at: number;
      status: string;
    }[]
  >(
    "SELECT id, customer_name, total_amount, paid_so_far, notes, created_at, status FROM installment_plans ORDER BY created_at DESC",
  );

  const items = await db.select<
    {
      id: string;
      plan_id: string;
      product_id: string;
      quantity: number;
      unit_price: number;
      line_total: number;
    }[]
  >("SELECT id, plan_id, product_id, quantity, unit_price, line_total FROM installment_items");

  const pids = [...new Set(items.map((i) => i.product_id))];
  const pmap = await productMapByIds(pids);

  const byPlan = new Map<string, InstallmentItem[]>();
  for (const i of items) {
    const row: InstallmentItem = {
      id: i.id,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      lineTotal: i.line_total,
      product: pmap.get(i.product_id) ?? null,
    };
    const list = byPlan.get(i.plan_id) ?? [];
    list.push(row);
    byPlan.set(i.plan_id, list);
  }

  return plans.map((p) => ({
    id: p.id,
    customerName: p.customer_name,
    totalAmount: p.total_amount,
    paidSoFar: p.paid_so_far,
    notes: p.notes,
    createdAt: p.created_at,
    status: p.status,
    items: byPlan.get(p.id) ?? [],
  }));
}

export async function fetchCreditDebtsBundle(): Promise<CreditDebt[]> {
  const db = await getDb();
  const rows = await db.select<
    {
      id: string;
      customer_name: string;
      quantity: number;
      unit_price_at_sale: number;
      total_owed: number;
      paid_so_far: number;
      notes: string | null;
      created_at: number;
      status: string;
      product_id: string;
    }[]
  >(
    `SELECT id, customer_name, quantity, unit_price_at_sale, total_owed, paid_so_far,
            notes, created_at, status, product_id
     FROM credit_debts ORDER BY created_at DESC`,
  );

  const pmap = await productMapByIds(rows.map((r) => r.product_id));

  return rows.map((r) => ({
    id: r.id,
    customerName: r.customer_name,
    quantity: r.quantity,
    unitPriceAtSale: r.unit_price_at_sale,
    totalOwed: r.total_owed,
    paidSoFar: r.paid_so_far,
    notes: r.notes,
    createdAt: r.created_at,
    status: r.status,
    product: pmap.get(r.product_id) ?? null,
  }));
}

export type TeamMemberRow = {
  profileId: string;
  displayName: string | undefined;
  role: string;
};

export async function fetchTeamMembers(): Promise<TeamMemberRow[]> {
  const rows = await fetchProfiles();
  return rows
    .map((p) => ({
      profileId: p.id,
      displayName: p.displayName ?? undefined,
      role: p.role,
    }))
    .sort((a, b) =>
      (a.displayName ?? "").localeCompare(b.displayName ?? ""),
    );
}

export async function fetchRecoveryKeyConfigured(): Promise<boolean> {
  const db = await getDb();
  return hasRecoveryKey(db);
}
