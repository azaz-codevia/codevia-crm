import { Pool, types } from "pg";
import { attachDatabasePool } from "@vercel/functions";

/**
 * Postgres access for Vercel + Supabase's transaction pooler.
 *
 * Uses node-postgres with Vercel's `attachDatabasePool`, which closes idle connections before a
 * function instance is suspended. That prevents the "dead socket after freeze" hangs that
 * long-lived clients hit on serverless.
 *
 * Queries keep a tagged-template API:
 *   const rows = await db()<User[]>`select * from users where id = ${id}`;
 * Values become bind parameters ($1, $2…). Interpolating another sql`` template inlines it as a
 * fragment; sql.unsafe() inlines trusted raw SQL; sql.json() sends a JSON value.
 */

// numeric and bigint → JS numbers (values in this app stay well inside the safe range)
types.setTypeParser(1700, (v) => Number(v));
types.setTypeParser(20, (v) => Number(v));

export type Row = Record<string, unknown>;

export class Fragment {
  constructor(
    readonly strings: readonly string[],
    readonly values: readonly unknown[],
  ) {}
}
class Raw {
  constructor(readonly text: string) {}
}
class Json {
  constructor(readonly value: unknown) {}
}

function compile(fragment: Fragment, params: unknown[]): string {
  let text = fragment.strings[0];
  for (let i = 0; i < fragment.values.length; i++) {
    const v = fragment.values[i];
    if (v instanceof Fragment) text += compile(v, params);
    else if (v instanceof Raw) text += v.text;
    else if (v instanceof Json) {
      params.push(JSON.stringify(v.value ?? null));
      text += `$${params.length}`;
    } else {
      params.push(v === undefined ? null : v);
      text += `$${params.length}`;
    }
    text += fragment.strings[i + 1];
  }
  return text;
}

/** A lazily-executed query: runs only when awaited, and can be nested inside another query. */
export class Query<T = Row[]> extends Fragment implements PromiseLike<T> {
  private promise?: Promise<T>;
  constructor(
    private readonly pool: () => Pool,
    strings: readonly string[],
    values: readonly unknown[],
  ) {
    super(strings, values);
  }
  private run(): Promise<T> {
    if (!this.promise) {
      const params: unknown[] = [];
      const text = compile(this, params);
      this.promise = this.pool()
        .query(text, params)
        .then((r) => r.rows as T);
    }
    return this.promise;
  }
  then<A = T, B = never>(onfulfilled?: ((value: T) => A | PromiseLike<A>) | null, onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null): Promise<A | B> {
    return this.run().then(onfulfilled, onrejected);
  }
  catch<B = never>(onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null) {
    return this.run().catch(onrejected);
  }
}

export interface Sql {
  <T = Row[]>(strings: TemplateStringsArray, ...values: unknown[]): Query<T>;
  json(value: unknown): Json;
  unsafe(text: string): Raw;
}

const globalForDb = globalThis as unknown as { __cvPool?: Pool; __cvSql?: Sql };

function pool(): Pool {
  if (globalForDb.__cvPool) return globalForDb.__cvPool;
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");
  const url = new URL(raw);
  const local = /^(localhost|127\.0\.0\.1)$/.test(url.hostname);
  // SSL is configured below; a sslmode in the URL would override it with strict cert checks
  url.searchParams.delete("sslmode");

  const p = new Pool({
    connectionString: url.toString(),
    ssl: local ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 5_000, // short, as Vercel recommends for Fluid compute
    connectionTimeoutMillis: 10_000,
    query_timeout: 25_000, // fail fast instead of hanging until the function limit
    allowExitOnIdle: true,
  });
  // An idle client dropped by the pooler must never crash the process
  p.on("error", (err) => console.error("[db] idle client error:", err.message));
  attachDatabasePool(p);
  globalForDb.__cvPool = p;
  return p;
}

export function db(): Sql {
  if (globalForDb.__cvSql) return globalForDb.__cvSql;
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => new Query(pool, strings, values)) as Sql;
  sql.json = (value) => new Json(value);
  sql.unsafe = (text) => new Raw(text);
  globalForDb.__cvSql = sql;
  return sql;
}
