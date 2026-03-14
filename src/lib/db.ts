import { neon } from "@neondatabase/serverless";
import { env } from "./env";

// ── Pooled (runtime) connection ─────────────────────────────────────────────
// DATABASE_URL should point to the Neon pooled endpoint (-pooler.neon.tech).
// The neon() HTTP driver is inherently stateless (one HTTP request per query),
// so it does not hold open TCP connections or leak connection slots. The pooled
// endpoint is still preferred because Neon routes it through PgBouncer, which
// provides connection reuse and better latency under concurrent load.
//
// IMPORTANT: Do not use SET, PREPARE, TEMPORARY TABLE, or session-level
// commands through this client — PgBouncer transaction mode does not preserve
// session state between queries.

let _db: ReturnType<typeof neon> | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sql = <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: any[]): Promise<T[]> => {
  if (!_db) {
    _db = neon(env.DATABASE_URL);
  }
  return _db(strings, ...values) as unknown as Promise<T[]>;
};

export default sql;

/** Execute a raw SQL string with positional parameters — use when building dynamic SET/IN clauses. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sqlRaw = <T = Record<string, unknown>>(text: string, values: any[] = []): Promise<T[]> => {
  if (!_db) {
    _db = neon(env.DATABASE_URL);
  }
  // neon supports (text, params) direct-call form in addition to tagged template
  return (_db as any)(text, values) as unknown as Promise<T[]>;
};

// ── Unpooled (migration) connection ─────────────────────────────────────────
// DATABASE_URL_UNPOOLED is the direct Neon endpoint (no PgBouncer). Required
// for DDL migrations (CREATE TABLE, ALTER TABLE) that may need session-level
// features. Falls back to DATABASE_URL if not set (works for dev).

let _dbUnpooled: ReturnType<typeof neon> | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sqlUnpooled = <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: any[]): Promise<T[]> => {
  if (!_dbUnpooled) {
    _dbUnpooled = neon(env.DATABASE_URL_UNPOOLED || env.DATABASE_URL);
  }
  return _dbUnpooled(strings, ...values) as unknown as Promise<T[]>;
};
