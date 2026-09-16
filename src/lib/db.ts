import postgres from "postgres";

type Sql = postgres.Sql<Record<string, never>>;

/**
 * Serverless-safe Postgres client for Supabase's transaction pooler.
 *
 * Vercel freezes function instances between requests. While frozen, the pooler/NAT can drop
 * idle TCP connections, and the client's own idle timers are paused too. When the instance
 * wakes up, reusing that dead socket makes queries hang until the function times out.
 *
 * Fix: remember when the client last ran a query. If it has been idle longer than
 * RECYCLE_AFTER_MS (which is what a frozen instance looks like from the inside, because wall-clock
 * time keeps moving), retire it gracefully and open a fresh client. Busy instances keep reusing
 * their warm connections, so there's no cost under steady traffic.
 */
const RECYCLE_AFTER_MS = 10_000;

type State = { sql: Sql; lastUsed: number };
const globalForDb = globalThis as unknown as { __cvDb?: State };

function create(): State {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const local = /localhost|127\.0\.0\.1/.test(url);
  const state = { lastUsed: Date.now() } as State;
  state.sql = postgres(url, {
    prepare: false, // required by the transaction pooler (port 6543)
    max: process.env.NODE_ENV === "production" ? 3 : 5,
    idle_timeout: 5, // close unused connections quickly while the instance is awake
    max_lifetime: 60 * 5,
    connect_timeout: 10,
    ssl: local ? false : "require",
    onnotice: () => {},
    // Called for every query: keeps the "last used" clock accurate during long requests
    debug: () => {
      state.lastUsed = Date.now();
    },
    types: {
      numeric: { to: 1700, from: [1700, 20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
    },
  }) as unknown as Sql;
  return state;
}

export function db(): Sql {
  const now = Date.now();
  const current = globalForDb.__cvDb;
  if (current && now - current.lastUsed < RECYCLE_AFTER_MS) {
    current.lastUsed = now;
    return current.sql;
  }
  if (current) {
    // Let any in-flight query finish, then drop the old (possibly dead) sockets.
    current.sql.end({ timeout: 5 }).catch(() => {});
  }
  const fresh = create();
  globalForDb.__cvDb = fresh;
  return fresh.sql;
}
