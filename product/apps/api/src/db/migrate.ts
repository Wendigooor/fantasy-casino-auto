import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
  user: process.env.POSTGRES_USER || "casino",
  password: process.env.POSTGRES_PASSWORD || "casino_dev_password",
  database: process.env.POSTGRES_DB || "fantasy_casino",
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())");

    const migrationsDir = path.join(__dirname, "../../migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const result = await client.query("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1");
    const lastVersion = result.rows.length > 0 ? result.rows[0].version : 0;

    for (const file of files) {
      const version = parseInt(file.split("_")[0], 10);
      if (version <= lastVersion) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      console.log(`Applying migration ${version}: ${file}`);
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      await client.query("COMMIT");
      console.log(`  -> Applied ${file}`);
    }

    console.log("Migrations complete");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
