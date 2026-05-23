// LOCAL-MIGRATION (Wave 1): the file path is preserved so existing route
// imports keep working, but the contents are now a tiny query-builder shim
// over better-sqlite3 that mimics the (subset of the) supabase-js API the
// existing routes actually use. Anything we didn't bother to mimic throws
// "not supported in local mode" so it's obvious where to port a callsite.
//
// Supported per-table chain: select / insert / update / upsert / delete,
// then .eq .neq .in .is .not .contains .or .order .limit .single .maybeSingle.
// `select(cols, { count: 'exact', head: true })` returns just `{ count }`.
// `update/insert/upsert` followed by `.select(...)` returns the affected rows.
//
// JSON columns (Postgres JSONB → SQLite TEXT) are parsed on read and
// stringified on write per `JSON_COLS` below.
//
// Auth helpers (`getUserIdFromRequest`) are kept as a back-compat thin
// wrapper — in local mode there is exactly one user, "local".

import { db, jsonGet, jsonSet } from "./db";

// ---------------------------------------------------------------------------
// JSON-typed columns. Tables not listed here have no JSON columns.
// ---------------------------------------------------------------------------
const JSON_COLS: Record<string, Set<string>> = {
  projects: new Set(["shared_with"]),
  documents: new Set(["structure_tree"]),
  workflows: new Set(["columns_config"]),
  chat_messages: new Set(["content", "files", "annotations", "workflow"]),
  tabular_reviews: new Set(["columns_config", "shared_with"]),
  // tabular_cells.content is JSON-stringified by the route handlers
  // themselves; we still parse it when the shim reads it back so callers
  // that expect a parsed object don't have to JSON.parse twice.
  tabular_cells: new Set(["content", "citations"]),
  tabular_review_chat_messages: new Set(["content", "annotations"]),
  user_profiles: new Set(["ai_keys"]),
};

function isJsonCol(table: string, col: string): boolean {
  return !!JSON_COLS[table]?.has(col);
}

function decodeRow(table: string, row: Record<string, unknown> | undefined) {
  if (!row) return row;
  const cols = JSON_COLS[table];
  if (!cols) return row;
  const out: Record<string, unknown> = { ...row };
  for (const c of cols) {
    if (c in out) out[c] = jsonGet(out[c]);
  }
  return out;
}

function encodeValue(table: string, col: string, value: unknown): unknown {
  if (isJsonCol(table, col)) return jsonSet(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === undefined) return null;
  return value;
}

// ---------------------------------------------------------------------------
// Supabase-shaped result type.
// ---------------------------------------------------------------------------
// We mirror supabase-js's loose typing here on purpose — the existing route
// code casts `data` aggressively at the use site (often via `as { ... }[]`),
// so a permissive `any` keeps the migration surface area small. When we
// rewrite call sites in Wave 2 we can tighten this up.
//
// `data` is typed `any` rather than `T | null` so that callbacks like
// `.map((c) => c.foo)` don't trip noImplicitAny — that's the same shape
// supabase-js exposes when no row generic is supplied.
// Mirror supabase-js's PostgrestResponse shape — a discriminated union over
// success vs failure. The discriminant matters: it's what lets TS narrow
// `data` to a non-null type when callers do `if (error) ...; const arr = data;`
// or the more common `(data ?? []).map(…)` pattern. Without the union,
// `(any | null) ?? []` widens to `never[]` and every callback param fails
// noImplicitAny.
//
// We keep it generic so individual call sites can still tighten `T` if
// they want, but every method here returns `Result` (= `Result<any>`)
// matching supabase-js's untyped default.
//
// Single-row results carry `data: T | null` instead; that distinction is
// kept by the runtime branch below.
// Two response shapes — array and single — each modeled as a discriminated
// success/failure union. The discriminator (`success`) is what makes the
// `(data ?? []).map(...)` pattern narrow without falling into `never[]`.
// The runtime is identical; only the static type differs based on whether
// the caller chained `.single()` / `.maybeSingle()`.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ArrayResult =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { success: true; data: any[]; error: null; count: number | null }
  | { success: false; data: null; error: { message: string }; count: null };
type SingleResult =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { success: true; data: any; error: null; count: number | null }
  | { success: false; data: null; error: { message: string }; count: null };
type Result = ArrayResult;

// Type-level handle returned by .single()/.maybeSingle() so `await` resolves
// to a SingleResult (where `data` is the row object or null). Runtime is
// the same QueryBuilder instance — the cast is purely for callers.
type SingleAwaitable = PromiseLike<SingleResult>;
function ok(data: unknown, count: number | null = null): Result {
  return {
    success: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: data as any,
    error: null,
    count,
  };
}
function fail(message: string): Result {
  return { success: false, data: null, error: { message }, count: null };
}

type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Filter primitives. We accumulate predicates and fold them into a WHERE
// clause at execute time. Special operators (or / contains) read or rewrite
// the same condition list.
// ---------------------------------------------------------------------------
type Cond =
  | { kind: "eq"; col: string; val: unknown }
  | { kind: "neq"; col: string; val: unknown }
  | { kind: "in"; col: string; vals: unknown[] }
  | { kind: "isNull"; col: string }
  | { kind: "isNotNull"; col: string }
  | { kind: "raw"; sql: string; params: unknown[] };

function buildWhere(table: string, conds: Cond[]): { sql: string; params: unknown[] } {
  if (conds.length === 0) return { sql: "", params: [] };
  const parts: string[] = [];
  const params: unknown[] = [];
  for (const c of conds) {
    switch (c.kind) {
      case "eq":
        parts.push(`"${c.col}" = ?`);
        params.push(encodeValue(table, c.col, c.val));
        break;
      case "neq":
        parts.push(`"${c.col}" IS NOT ?`);
        params.push(encodeValue(table, c.col, c.val));
        break;
      case "in":
        if (c.vals.length === 0) {
          parts.push("0");
        } else {
          parts.push(`"${c.col}" IN (${c.vals.map(() => "?").join(",")})`);
          for (const v of c.vals) params.push(encodeValue(table, c.col, v));
        }
        break;
      case "isNull":
        parts.push(`"${c.col}" IS NULL`);
        break;
      case "isNotNull":
        parts.push(`"${c.col}" IS NOT NULL`);
        break;
      case "raw":
        parts.push(c.sql);
        for (const p of c.params) params.push(p);
        break;
    }
  }
  return { sql: " WHERE " + parts.join(" AND "), params };
}

// ---------------------------------------------------------------------------
// QueryBuilder: covers SELECT (with optional .single/.maybeSingle and head-
// count), as well as DELETE / UPDATE finalisation. INSERT/UPSERT take their
// own short path before returning a builder for the optional .select().single().
// ---------------------------------------------------------------------------

type Action = "select" | "delete" | "update";

class QueryBuilder implements PromiseLike<Result> {
  private conds: Cond[] = [];
  private orderBy: { col: string; asc: boolean }[] = [];
  private limitN: number | null = null;
  private singleMode: "none" | "single" | "maybe" = "none";
  private cols = "*";
  private headCount = false;
  private updates: Row | null = null;
  private inserts: Row[] = [];
  private upsertConflict: string[] | null = null;
  // For containment checks against JSON-encoded array columns.
  private jsonContains: { col: string; values: unknown[] }[] = [];

  constructor(
    private table: string,
    private action: Action,
  ) {}

  // Filter operators -------------------------------------------------------

  eq(col: string, val: unknown): this {
    this.conds.push({ kind: "eq", col, val });
    return this;
  }
  neq(col: string, val: unknown): this {
    this.conds.push({ kind: "neq", col, val });
    return this;
  }
  in(col: string, vals: unknown[]): this {
    this.conds.push({ kind: "in", col, vals: vals ?? [] });
    return this;
  }
  is(col: string, val: unknown): this {
    if (val === null) this.conds.push({ kind: "isNull", col });
    else throw new Error(`is(${col}, ${val}) not supported`);
    return this;
  }
  not(col: string, op: string, val: unknown): this {
    if (op === "is" && val === null) {
      this.conds.push({ kind: "isNotNull", col });
      return this;
    }
    throw new Error(`not(${col}, ${op}, ${val}) not supported in local mode`);
  }
  /**
   * Loose port of supabase's `.contains("col", [v])` for JSON-array columns.
   * Original Postgres: `col @> '["v"]'::jsonb`. We can't push that into
   * SQLite, so we filter in JS post-fetch (see _runSelect).
   */
  contains(col: string, value: unknown): this {
    let arr: unknown[];
    if (Array.isArray(value)) arr = value;
    else if (typeof value === "string") {
      try {
        const p = JSON.parse(value);
        arr = Array.isArray(p) ? p : [p];
      } catch {
        arr = [value];
      }
    } else {
      arr = [value];
    }
    this.jsonContains.push({ col, values: arr });
    return this;
  }
  /**
   * Limited `.or(filter)` support. Routes only use one shape here:
   *     "user_id.eq.<id>,project_id.in.(<a>,<b>,<c>)"
   * Anything more exotic throws — port the callsite to two queries instead.
   */
  or(filter: string): this {
    const parts = splitTopLevelCsv(filter);
    const orParts: string[] = [];
    const params: unknown[] = [];
    for (const part of parts) {
      const m = part.match(/^([a-zA-Z0-9_]+)\.(eq|neq|in)\.(.*)$/);
      if (!m) {
        throw new Error(`or() filter not supported in local mode: ${part}`);
      }
      const [, col, op, rest] = m;
      if (op === "eq") {
        orParts.push(`"${col}" = ?`);
        params.push(rest);
      } else if (op === "neq") {
        orParts.push(`"${col}" IS NOT ?`);
        params.push(rest);
      } else if (op === "in") {
        const inner = rest.replace(/^\(/, "").replace(/\)$/, "");
        const ids = inner.length ? inner.split(",") : [];
        if (ids.length === 0) {
          orParts.push("0");
        } else {
          orParts.push(`"${col}" IN (${ids.map(() => "?").join(",")})`);
          for (const id of ids) params.push(id);
        }
      }
    }
    this.conds.push({
      kind: "raw",
      sql: `(${orParts.join(" OR ")})`,
      params,
    });
    return this;
  }

  // Shape modifiers --------------------------------------------------------

  order(
    col: string,
    opts?: { ascending?: boolean; nullsFirst?: boolean },
  ): this {
    this.orderBy.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number): this {
    this.limitN = n;
    return this;
  }
  single(): SingleAwaitable {
    this.singleMode = "single";
    return this as unknown as SingleAwaitable;
  }
  maybeSingle(): SingleAwaitable {
    this.singleMode = "maybe";
    return this as unknown as SingleAwaitable;
  }

  /**
   * For UPDATE/DELETE chains: `.select(cols)` says "return the affected rows".
   * For SELECT chains: re-points the column list (used when callers do
   * `.from(t).insert(...).select("id, foo")`).
   */
  select(
    cols: string = "*",
    opts?: { count?: "exact"; head?: boolean },
  ): QueryBuilder {
    this.cols = cols;
    if (opts?.count === "exact" && opts?.head) this.headCount = true;
    return this;
  }

  // Internal — INSERT/UPSERT/UPDATE wiring --------------------------------

  _setInserts(rows: Row[]): this {
    this.inserts = rows;
    return this;
  }
  _setUpserts(rows: Row[], onConflict: string | undefined): this {
    this.inserts = rows;
    this.upsertConflict = (onConflict ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    return this;
  }
  _setUpdates(updates: Row): this {
    this.updates = updates;
    return this;
  }

  // Promise interface ------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  then(onfulfilled?: ((v: Result) => any) | null, onrejected?: any): any {
    return Promise.resolve()
      .then(() => this._run())
      .then(onfulfilled as never, onrejected);
  }

  // Execution --------------------------------------------------------------

  private _run(): Result {
    try {
      if (this.action === "select") return this._runSelect();
      if (this.action === "delete") return this._runDelete();
      if (this.action === "update") return this._runUpdate();
      throw new Error(`Unknown action ${this.action}`);
    } catch (err) {
      return fail((err as Error).message);
    }
  }

  private _runSelect(): Result {
    if (this.headCount) {
      const where = buildWhere(this.table, this.conds);
      const sql = `SELECT COUNT(*) AS c FROM "${this.table}"${where.sql}`;
      const row = db.prepare(sql).get(...where.params) as { c: number };
      return ok(null, row.c);
    }

    const where = buildWhere(this.table, this.conds);
    const orderSql = this.orderBy.length
      ? " ORDER BY " +
        this.orderBy.map((o) => `"${o.col}" ${o.asc ? "ASC" : "DESC"}`).join(", ")
      : "";
    const limitSql = this.limitN != null ? ` LIMIT ${this.limitN}` : "";
    // We always read full rows internally (for JSON decode + post-filter),
    // then project columns at the end.
    const sql = `SELECT * FROM "${this.table}"${where.sql}${orderSql}${limitSql}`;
    let rows = db.prepare(sql).all(...where.params) as Row[];

    // JSON decode.
    rows = rows.map((r) => decodeRow(this.table, r) as Row);

    // JSON-array containment is filtered post-fetch.
    if (this.jsonContains.length > 0) {
      rows = rows.filter((r) =>
        this.jsonContains.every(({ col, values }) => {
          const arr = r[col];
          if (!Array.isArray(arr)) return false;
          return values.every((v) => arr.includes(v));
        }),
      );
    }

    // Column projection (best-effort — "*" or comma list of bare column
    // names; embedded foreign-table syntax isn't supported and would have
    // already failed elsewhere).
    const projected =
      this.cols === "*"
        ? rows
        : rows.map((r) => {
            const out: Row = {};
            for (const raw of this.cols.split(",")) {
              const c = raw.trim();
              if (!c) continue;
              if (c in r) out[c] = r[c];
            }
            return out;
          });

    if (this.singleMode === "single") {
      if (projected.length !== 1) {
        return fail(
          projected.length === 0 ? "No rows found" : "Multiple rows returned",
        );
      }
      return ok(projected[0]);
    }
    if (this.singleMode === "maybe") {
      return ok(projected[0] ?? null);
    }
    return ok(projected);
  }

  private _runDelete(): Result {
    const where = buildWhere(this.table, this.conds);
    db.prepare(`DELETE FROM "${this.table}"${where.sql}`).run(...where.params);
    return ok(null);
  }

  private _runUpdate(): Result {
    if (!this.updates) throw new Error("update() called without payload");
    const cols = Object.keys(this.updates);
    if (cols.length === 0) return ok(null);
    const setSql = cols.map((c) => `"${c}" = ?`).join(", ");
    const setParams = cols.map((c) => encodeValue(this.table, c, this.updates![c]));
    const where = buildWhere(this.table, this.conds);
    const sql = `UPDATE "${this.table}" SET ${setSql}${where.sql}`;
    db.prepare(sql).run(...setParams, ...where.params);
    if (this.cols === "*" && this.singleMode === "none") {
      return ok(null);
    }
    // Caller wanted the updated row(s) back.
    return new QueryBuilder(this.table, "select")
      ._copyFiltersFrom(this)
      ._runSelect();
  }

  // Used after INSERT/UPSERT/UPDATE to fetch returning rows.
  _copyFiltersFrom(other: QueryBuilder): this {
    this.conds = [...other.conds];
    this.orderBy = [...other.orderBy];
    this.limitN = other.limitN;
    this.singleMode = other.singleMode;
    this.cols = other.cols;
    this.jsonContains = [...other.jsonContains];
    return this;
  }
}

function splitTopLevelCsv(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

// ---------------------------------------------------------------------------
// `.from(table)` entry point — returns an object that exposes the four
// top-level verbs (select/insert/update/delete/upsert).
// ---------------------------------------------------------------------------
function fromTable(table: string) {
  return {
    select(cols: string = "*", opts?: { count?: "exact"; head?: boolean }) {
      const qb = new QueryBuilder(table, "select");
      qb.select(cols, opts);
      return qb;
    },
    delete() {
      return new QueryBuilder(table, "delete");
    },
    update(updates: Row) {
      const qb = new QueryBuilder(table, "update");
      qb._setUpdates(updates);
      return qb;
    },
    insert(rows: Row | Row[]) {
      const arr = Array.isArray(rows) ? rows : [rows];
      // Auto-fill primary keys + timestamps so callers can keep their
      // Supabase-style `insert({ user_id, ... })` calls without thinking
      // about UUID generation.
      const prepared = arr.map((r) => prepareInsertRow(table, r));
      const inserted = runInsert(table, prepared);
      return new InsertReturning(table, inserted);
    },
    upsert(
      rows: Row | Row[],
      opts?: { onConflict?: string; ignoreDuplicates?: boolean },
    ) {
      const arr = Array.isArray(rows) ? rows : [rows];
      const prepared = arr.map((r) => prepareInsertRow(table, r));
      const inserted = runUpsert(
        table,
        prepared,
        opts?.onConflict,
        !!opts?.ignoreDuplicates,
      );
      return new InsertReturning(table, inserted);
    },
  };
}

// `.insert(...).select("...").single()` returning helper. Delegates straight
// to a SELECT once the insert has happened.
class InsertReturning implements PromiseLike<Result> {
  private singleMode: "none" | "single" | "maybe" = "none";
  private cols = "*";
  constructor(
    private table: string,
    private rows: Row[],
  ) {}
  select(cols: string = "*"): InsertReturning {
    this.cols = cols;
    return this;
  }
  single(): SingleAwaitable {
    this.singleMode = "single";
    return this as unknown as SingleAwaitable;
  }
  maybeSingle(): SingleAwaitable {
    this.singleMode = "maybe";
    return this as unknown as SingleAwaitable;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  then(onfulfilled?: ((v: Result) => any) | null, onrejected?: any): any {
    return Promise.resolve()
      .then(() => this._run())
      .then(onfulfilled as never, onrejected);
  }
  private _run(): Result {
    const decoded = this.rows.map((r) => decodeRow(this.table, r) as Row);
    const projected =
      this.cols === "*"
        ? decoded
        : decoded.map((r) => {
            const out: Row = {};
            for (const raw of this.cols.split(",")) {
              const c = raw.trim();
              if (!c) continue;
              if (c in r) out[c] = r[c];
            }
            return out;
          });
    if (this.singleMode === "single") {
      if (projected.length !== 1) {
        return fail("Insert did not return exactly one row");
      }
      return ok(projected[0]);
    }
    if (this.singleMode === "maybe") {
      return ok(projected[0] ?? null);
    }
    return ok(projected);
  }
}

// ---------------------------------------------------------------------------
// Insert helpers — fill in PK + updated_at, encode JSON columns.
// ---------------------------------------------------------------------------

const TABLES_WITH_UUID_PK = new Set([
  "user_profiles",
  "projects",
  "project_subfolders",
  "documents",
  "document_versions",
  "document_edits",
  "workflows",
  "hidden_workflows",
  "workflow_shares",
  "chats",
  "chat_messages",
  "tabular_reviews",
  "tabular_cells",
  "tabular_review_chats",
  "tabular_review_chat_messages",
  "mcp_tokens",
]);

function prepareInsertRow(table: string, raw: Row): Row {
  const r: Row = { ...raw };
  if (TABLES_WITH_UUID_PK.has(table) && r.id == null) {
    r.id = (globalThis.crypto?.randomUUID?.() ?? fallbackUuid()) as string;
  }
  return r;
}

function fallbackUuid(): string {
  // Same shape Node 20+ would give us. Sufficient for primary keys.
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function runInsert(table: string, rows: Row[]): Row[] {
  if (rows.length === 0) return [];
  const out: Row[] = [];
  const cols = Object.keys(rows[0]);
  const placeholders = `(${cols.map(() => "?").join(",")})`;
  const sql = `INSERT INTO "${table}" (${cols
    .map((c) => `"${c}"`)
    .join(",")}) VALUES ${placeholders} RETURNING *`;
  const stmt = db.prepare(sql);
  for (const r of rows) {
    const params = cols.map((c) => encodeValue(table, c, r[c]));
    const ret = stmt.get(...params) as Row;
    out.push(ret);
  }
  return out;
}

function runUpsert(
  table: string,
  rows: Row[],
  onConflict: string | undefined,
  ignoreDuplicates: boolean,
): Row[] {
  if (rows.length === 0) return [];
  const out: Row[] = [];
  const cols = Object.keys(rows[0]);
  const placeholders = `(${cols.map(() => "?").join(",")})`;
  const conflictCols = (onConflict ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let conflictClause = "";
  if (conflictCols.length === 0) {
    conflictClause = ignoreDuplicates ? " ON CONFLICT DO NOTHING" : "";
  } else if (ignoreDuplicates) {
    conflictClause = ` ON CONFLICT(${conflictCols.map((c) => `"${c}"`).join(",")}) DO NOTHING`;
  } else {
    const updates = cols
      .filter((c) => !conflictCols.includes(c))
      .map((c) => `"${c}" = excluded."${c}"`)
      .join(", ");
    conflictClause = updates
      ? ` ON CONFLICT(${conflictCols.map((c) => `"${c}"`).join(",")}) DO UPDATE SET ${updates}`
      : ` ON CONFLICT(${conflictCols.map((c) => `"${c}"`).join(",")}) DO NOTHING`;
  }
  const sql = `INSERT INTO "${table}" (${cols
    .map((c) => `"${c}"`)
    .join(",")}) VALUES ${placeholders}${conflictClause} RETURNING *`;
  const stmt = db.prepare(sql);
  for (const r of rows) {
    const params = cols.map((c) => encodeValue(table, c, r[c]));
    const ret = stmt.get(...params) as Row | undefined;
    if (ret) out.push(ret);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public client facade. `auth.admin.*` calls are stubbed for local mode —
// route handlers that actually need them have been edited to bypass the
// admin client and use the shim's `local` user directly. We surface clear
// errors here so any missed callsite is loud.
// ---------------------------------------------------------------------------
const localClient = {
  from: fromTable,
  auth: {
    getUser: async (_token: string) => ({
      data: { user: { id: "local", email: "" } },
      error: null,
    }),
    admin: {
      listUsers: async (_opts?: { perPage?: number }) => {
        throw new Error(
          "auth.admin.listUsers is not supported in local mode; route should use the local user directly.",
        );
      },
      deleteUser: async (_id: string) => ({
        data: null,
        error: { message: "auth.admin.deleteUser is not supported in local mode" },
      }),
      getUserById: async (_id: string) => ({
        data: { user: { id: "local", email: "" } },
        error: null,
      }),
    },
  },
};

export function createServerSupabase() {
  return localClient;
}

/**
 * Back-compat export — historically returned the user's UUID extracted from
 * a Supabase JWT. In local mode we resolve the bearer token to a session and
 * return the conceptual "local" user id. Throws a Response on failure to
 * preserve the old call shape (used by the few places that used the
 * fetch-style Request signature).
 */
export async function getUserIdFromRequest(req: Request): Promise<string> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    throw new Response("Missing or invalid Authorization header", {
      status: 401,
    });
  }
  const token = auth.slice(7).trim();
  const row = db
    .prepare("SELECT token FROM sessions WHERE token = ?")
    .get(token) as { token: string } | undefined;
  if (!row) throw new Response("Invalid session", { status: 401 });
  return "local";
}
