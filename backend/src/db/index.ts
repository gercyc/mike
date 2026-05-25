import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;

export function buildDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;

  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;

  if (!host || !port || !user || !password || !database) {
    throw new Error(
      "Either DATABASE_URL or all of DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME must be set"
    );
  }

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

export function getDb() {
  if (!_db) {
    const url = buildDatabaseUrl();
    const client = postgres(url, { max: 20 });
    _db = drizzle(client, { schema });
  }
  return _db;
}

export type Db = ReturnType<typeof getDb>;
export * from "./schema";
