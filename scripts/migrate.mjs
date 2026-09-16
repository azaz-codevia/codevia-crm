// Applies db/schema.sql to the database.
// Usage: DIRECT_DATABASE_URL=... npm run db:migrate   (or put it in .env.local)
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
loadEnv(path.join(root, ".env.local"));
loadEnv(path.join(root, ".env"));

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Set DIRECT_DATABASE_URL or DATABASE_URL first.");
  process.exit(1);
}

const u = new URL(url);
u.searchParams.delete("sslmode");
const client = new pg.Client({ connectionString: u.toString(), ssl: needsSsl(url) ? { rejectUnauthorized: false } : false });
await client.connect();
const schema = readFileSync(path.join(root, "db", "schema.sql"), "utf8");

try {
  await client.query(schema);
  console.log("✔ Schema applied");
} catch (err) {
  console.error("✖ Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

function needsSsl(u) {
  return !/localhost|127\.0\.0\.1/.test(u);
}
function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
