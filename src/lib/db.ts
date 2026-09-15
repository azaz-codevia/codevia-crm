import postgres from "postgres";

type Sql = postgres.Sql<Record<string, never>>;

const globalForDb = globalThis as unknown as { __cvSql?: Sql };

/**
 * Shared Postgres client. Created lazily so builds don't need DATABASE_URL.
 * `prepare: false` is required for Supabase's transaction pooler (port 6543).
 */
export function db(): Sql {
  if (globalForDb.__cvSql) return globalForDb.__cvSql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const local = /localhost|127\.0\.0\.1/.test(url);
  const client = postgres(url, {
    prepare: false,
    max: process.env.NODE_ENV === "production" ? 3 : 5,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: local ? false : "require",
    onnotice: () => {},
    types: {
      // Return numeric/bigint as JS numbers (values here stay well inside safe range)
      numeric: { to: 1700, from: [1700, 20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
    },
  }) as unknown as Sql;
  globalForDb.__cvSql = client;
  return client;
}
