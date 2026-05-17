import Database from "@tauri-apps/plugin-sql";
import { ROLES } from "@/lib/constants";
import { ensureSuperAdminPasscodeDefaults } from "@/lib/admin-passcode";

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

  `CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_stock_mov_created ON stock_movements(created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at DESC);`,

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

  const id = crypto.randomUUID();
  const now = Date.now();
  await db.execute(
    "INSERT INTO profiles (id, role, display_name, created_at) VALUES (?, ?, ?, ?)",
    [id, ROLES.super_admin, "Owner", now],
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
      return db;
    })();
  }
  return initPromise;
}

export async function getDb(): Promise<Database> {
  return initSqliteDatabase();
}
