import Database from "@tauri-apps/plugin-sql";
import { ROLES } from "@/lib/constants";
import { ensureSuperAdminPasscodeDefaults } from "@/lib/admin-passcode";
import { randomUuid } from "@/lib/random-id";

const DB_FILE = "sqlite:muna-shop.db";

let initPromise: Promise<Database> | null = null;

/** One in-flight `execute` / `select` at a time — matches sqlite file locking; avoids pool contention (SQLITE_BUSY). */
let dbAccessChain: Promise<unknown> = Promise.resolve();

function wrapWithSerializedAccess(db: Database): Database {
  const enqueue = <T,>(fn: () => Promise<T>): Promise<T> => {
    const next = dbAccessChain.then(() => fn());
    dbAccessChain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  return {
    path: db.path,
    execute: (query, bindValues) => enqueue(() => db.execute(query, bindValues)),
    select: (query, bindValues) => enqueue(() => db.select(query, bindValues)),
    close: (name) => enqueue(() => db.close(name)),
  } as Database;
}

const MIGRATIONS: string[] = [
  `PRAGMA busy_timeout = 15000;`,
  `PRAGMA journal_mode = WAL;`,
  `PRAGMA synchronous = NORMAL;`,
  `PRAGMA foreign_keys = ON;`,

  `CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    display_name TEXT,
    created_at INTEGER NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    barcode TEXT UNIQUE,
    buying_price REAL NOT NULL,
    selling_price REAL NOT NULL,
    stock_quantity REAL NOT NULL,
    image_url TEXT,
    created_at INTEGER NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    total_amount REAL NOT NULL,
    created_at INTEGER NOT NULL,
    note TEXT,
    creator_id TEXT REFERENCES profiles(id)
  );`,

  `CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    line_total REAL NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    kind TEXT NOT NULL,
    quantity_delta REAL NOT NULL,
    note TEXT,
    created_at INTEGER NOT NULL,
    related_sale_id TEXT
  );`,

  `CREATE TABLE IF NOT EXISTS installment_plans (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    total_amount REAL NOT NULL,
    paid_so_far REAL NOT NULL,
    notes TEXT,
    created_at INTEGER NOT NULL,
    status TEXT NOT NULL,
    creator_id TEXT REFERENCES profiles(id)
  );`,

  `CREATE TABLE IF NOT EXISTS installment_items (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES installment_plans(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    line_total REAL NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS credit_debts (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price_at_sale REAL NOT NULL,
    total_owed REAL NOT NULL,
    paid_so_far REAL NOT NULL,
    notes TEXT,
    created_at INTEGER NOT NULL,
    status TEXT NOT NULL,
    creator_id TEXT REFERENCES profiles(id),
    product_id TEXT NOT NULL REFERENCES products(id)
  );`,

  `CREATE TABLE IF NOT EXISTS credit_debt_items (
    id TEXT PRIMARY KEY,
    debt_id TEXT NOT NULL REFERENCES credit_debts(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    line_total REAL NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS cash_collections (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    paid_at INTEGER NOT NULL,
    source_kind TEXT NOT NULL,
    source_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    note TEXT,
    creator_id TEXT REFERENCES profiles(id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_stock_mov_created ON stock_movements(created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_cash_collections_paid ON cash_collections(paid_at DESC);`,

  `CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);`,

  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );`,
];

async function seedDefaultProfile(db: Database) {
  const rows = await db.select<{ n: number }[]>(
    "SELECT COUNT(*) as n FROM profiles",
  );
  const n = rows[0]?.n ?? 0;
  if (n > 0) return;

  const id = randomUuid();
  const now = Date.now();
  await db.execute(
    "INSERT INTO profiles (id, role, display_name, created_at) VALUES (?, ?, ?, ?)",
    [id, ROLES.super_admin, "Owner", now],
  );
}

const CREDIT_DEBT_ITEMS_MIGRATION_KEY = "schema_credit_debt_items_v1";

/** Single-product pay-later rows → line items; header table drops per-SKU columns. */
async function migrateCreditDebtLineItems(db: Database) {
  const done = await db.select<{ value: string }[]>(
    "SELECT value FROM app_settings WHERE key = ? LIMIT 1",
    [CREDIT_DEBT_ITEMS_MIGRATION_KEY],
  );
  if (done[0]?.value === "1") return;

  await db.execute(
    `CREATE TABLE IF NOT EXISTS credit_debt_items (
      id TEXT PRIMARY KEY,
      debt_id TEXT NOT NULL REFERENCES credit_debts(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id),
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      line_total REAL NOT NULL
    );`,
  );

  const cols = await db.select<{ name: string }[]>(
    "PRAGMA table_info(credit_debts)",
  );
  const hasLegacyProduct = cols.some((c) => c.name === "product_id");
  if (!hasLegacyProduct) {
    await db.execute(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
      [CREDIT_DEBT_ITEMS_MIGRATION_KEY, "1"],
    );
    return;
  }

  type LegacyDebt = {
    id: string;
    customer_name: string;
    product_id: string;
    quantity: number;
    unit_price_at_sale: number;
    total_owed: number;
    paid_so_far: number;
    notes: string | null;
    created_at: number;
    status: string;
    creator_id: string | null;
  };

  const legacyDebts = await db.select<LegacyDebt[]>(
    `SELECT id, customer_name, product_id, quantity, unit_price_at_sale,
            total_owed, paid_so_far, notes, created_at, status, creator_id
     FROM credit_debts`,
  );

  type ItemRow = {
    id: string;
    debt_id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  };

  let itemRows = await db.select<ItemRow[]>(
    "SELECT id, debt_id, product_id, quantity, unit_price, line_total FROM credit_debt_items",
  );

  const itemsByDebt = new Set(itemRows.map((i) => i.debt_id));
  for (const debt of legacyDebts) {
    if (itemsByDebt.has(debt.id)) continue;
    const lineTotal = debt.unit_price_at_sale * debt.quantity;
    const itemId = randomUuid();
    await db.execute(
      `INSERT INTO credit_debt_items (id, debt_id, product_id, quantity, unit_price, line_total)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        itemId,
        debt.id,
        debt.product_id,
        debt.quantity,
        debt.unit_price_at_sale,
        lineTotal,
      ],
    );
    itemRows = [
      ...itemRows,
      {
        id: itemId,
        debt_id: debt.id,
        product_id: debt.product_id,
        quantity: debt.quantity,
        unit_price: debt.unit_price_at_sale,
        line_total: lineTotal,
      },
    ];
  }

  await db.execute("PRAGMA foreign_keys = OFF");
  try {
    await db.execute(
      `CREATE TABLE credit_debts_v2 (
        id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        total_owed REAL NOT NULL,
        paid_so_far REAL NOT NULL,
        notes TEXT,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL,
        creator_id TEXT REFERENCES profiles(id)
      );`,
    );

    await db.execute(
      `INSERT INTO credit_debts_v2 (id, customer_name, total_owed, paid_so_far, notes, created_at, status, creator_id)
       SELECT id, customer_name, total_owed, paid_so_far, notes, created_at, status, creator_id
       FROM credit_debts`,
    );

    await db.execute("DROP TABLE credit_debt_items");
    await db.execute("DROP TABLE credit_debts");
    await db.execute("ALTER TABLE credit_debts_v2 RENAME TO credit_debts");

    await db.execute(
      `CREATE TABLE credit_debt_items (
        id TEXT PRIMARY KEY,
        debt_id TEXT NOT NULL REFERENCES credit_debts(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES products(id),
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        line_total REAL NOT NULL
      );`,
    );

    for (const item of itemRows) {
      await db.execute(
        `INSERT INTO credit_debt_items (id, debt_id, product_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.debt_id,
          item.product_id,
          item.quantity,
          item.unit_price,
          item.line_total,
        ],
      );
    }
  } finally {
    await db.execute("PRAGMA foreign_keys = ON");
  }

  await db.execute(
    "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
    [CREDIT_DEBT_ITEMS_MIGRATION_KEY, "1"],
  );
}

export async function initSqliteDatabase(): Promise<Database> {
  if (!initPromise) {
    initPromise = (async () => {
      const raw = await Database.load(DB_FILE);
      const db = wrapWithSerializedAccess(raw);
      for (const stmt of MIGRATIONS) {
        await db.execute(stmt);
      }
      await seedDefaultProfile(db);
      await ensureSuperAdminPasscodeDefaults(db);
      await migrateCreditDebtLineItems(db);
      return db;
    })();
  }
  return initPromise;
}

export async function getDb(): Promise<Database> {
  return initSqliteDatabase();
}
