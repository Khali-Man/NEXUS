import "dotenv/config";
import pg from "pg";
const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://nexus:nexus-local-only@127.0.0.1:55432/nexus",
});
if (
  !(await pool.query("SELECT 1 FROM pg_database WHERE datname='nexus_test'"))
    .rowCount
)
  await pool.query("CREATE DATABASE nexus_test");
await pool.end();
