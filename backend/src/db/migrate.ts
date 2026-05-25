import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";
import { buildDatabaseUrl } from "./index";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

export async function runMigrations() {
  const url = buildDatabaseUrl();
  const migrationClient = postgres(url, { max: 1 });
  const db = drizzle(migrationClient, { schema });

  await ensureBaseline(migrationClient);

  const before = await getAppliedMigrations(migrationClient);
  console.log(`Running database migrations... (${before.length} already applied)`);

  try {
    await migrate(db, { migrationsFolder: "./migrations" });
  } catch (err) {
    console.error("Migration error:", err);
    throw err;
  }

  const after = await getAppliedMigrations(migrationClient);
  const newlyApplied = after.length - before.length;
  console.log(`Database migrations completed. ${newlyApplied} new migration(s) applied.`);

  await migrationClient.end();
}

async function getAppliedMigrations(client: postgres.Sql) {
  try {
    return await client`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`;
  } catch {
    return [];
  }
}

async function ensureBaseline(client: postgres.Sql) {
  // Check if the database already has tables (e.g., users table)
  const existingTables = await client`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'users'
  `;

  const hasExistingData = existingTables.length > 0;

  // Check if drizzle migration tracking table exists and has entries
  const migrationTracking = await client`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'drizzle'
      AND table_name = '__drizzle_migrations'
  `;

  const hasMigrationTracking = migrationTracking.length > 0;

  if (hasExistingData && !hasMigrationTracking) {
    console.log("Existing database detected without migration tracking. Performing baseline...");

    // Read the journal to find the initial migration
    const journalPath = path.join(process.cwd(), "migrations", "meta", "_journal.json");
    if (!fs.existsSync(journalPath)) {
      console.warn("Migration journal not found, skipping baseline.");
      return;
    }

    const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
    const initialEntry = journal.entries?.[0];
    if (!initialEntry) {
      console.warn("No initial migration entry found, skipping baseline.");
      return;
    }

    const sqlFileName = `${initialEntry.tag}.sql`;
    const sqlPath = path.join(process.cwd(), "migrations", sqlFileName);
    if (!fs.existsSync(sqlPath)) {
      console.warn(`Migration SQL file not found: ${sqlFileName}, skipping baseline.`);
      return;
    }

    const sqlContent = fs.readFileSync(sqlPath, "utf-8");
    const hash = createHash("sha256").update(sqlContent).digest("hex");
    const createdAt = initialEntry.when;

    // Create schema and tracking table
    await client`CREATE SCHEMA IF NOT EXISTS drizzle`;
    await client`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `;

    // Insert baseline record
    await client`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${createdAt})
    `;

    console.log(`Baseline completed for migration ${initialEntry.tag}.`);
  }
}
