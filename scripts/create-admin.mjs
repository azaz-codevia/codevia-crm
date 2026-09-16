// Creates (or resets) an admin user from the command line.
// Usage: npm run db:create-admin -- you@codevia.sa "Your Name" "a-strong-password"
// You can also create the first admin in the browser at /setup.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import bcrypt from "bcryptjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
for (const f of [".env.local", ".env"]) {
  const file = path.join(root, f);
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const [email, name, password] = process.argv.slice(2);
if (!email || !name || !password || password.length < 8) {
  console.error('Usage: npm run db:create-admin -- email "Full Name" "password (8+ chars)"');
  process.exit(1);
}

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const u = new URL(url);
u.searchParams.delete("sslmode");
const client = new pg.Client({ connectionString: u.toString(), ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
await client.connect();
const hash = await bcrypt.hash(password, 12);

try {
  const { rows: [existing] } = await client.query("select id from users where lower(email) = lower($1)", [email]);
  if (existing) {
    await client.query("update users set password_hash = $1, role = 'admin', is_active = true, name = $2 where id = $3", [hash, name, existing.id]);
    console.log("✔ Existing user promoted to admin and password reset");
  } else {
    await client.query("insert into users (name, email, password_hash, role) values ($1, $2, $3, 'admin')", [name, email.toLowerCase(), hash]);
    console.log("✔ Admin created");
  }
} finally {
  await client.end();
}
