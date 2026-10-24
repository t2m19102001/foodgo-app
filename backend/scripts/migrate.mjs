// Chay cac file SQL trong backend/migrations/ theo thu tu ten, mot lan moi file.
// Khong dung thu vien migration nao: moi migration la SQL thuan, doc duoc bang
// mat, va chay trong transaction rieng.
import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

if (!process.env.DATABASE_URL) {
  console.error("Thieu DATABASE_URL trong .env");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: true },
});

await client.connect();
await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`);

const { rows } = await client.query("SELECT filename FROM schema_migrations");
const applied = new Set(rows.map((row) => row.filename));

const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
let count = 0;

for (const file of files) {
  if (applied.has(file)) continue;
  const sql = await readFile(join(migrationsDir, file), "utf8");
  // File SQL tu mo BEGIN/COMMIT cua no, nen chi ghi so migration rieng sau khi
  // file chay xong. Neu file loi giua duong thi no tu rollback va ta dung lai.
  try {
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
    console.log(`  applied  ${file}`);
    count += 1;
  } catch (error) {
    console.error(`  FAILED   ${file}: ${error.message}`);
    await client.end();
    process.exit(1);
  }
}

console.log(count === 0 ? "Khong co migration moi." : `Da chay ${count} migration.`);
await client.end();
