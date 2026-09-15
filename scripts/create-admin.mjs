// Creates (or resets) an admin user from the command line.
// Usage: npm run db:create-admin -- you@codevia.sa "Your Name" "a-strong-password"
// You can also create the first admin in the browser at /setup.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import postgres from "postgres";
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
const sql = postgres(url, { prepare: false, max: 1, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require" });
const hash = await bcrypt.hash(password, 12);

try {
  const [existing] = await sql`select id from users where lower(email) = lower(${email})`;
  if (existing) {
    await sql`update users set password_hash = ${hash}, role = 'admin', is_active = true, name = ${name} where id = ${existing.id}`;
    console.log("✔ Existing user promoted to admin and password reset");
  } else {
    await sql`insert into users (name, email, password_hash, role) values (${name}, ${email.toLowerCase()}, ${hash}, 'admin')`;
    console.log("✔ Admin created");
  }
} finally {
  await sql.end();
}
