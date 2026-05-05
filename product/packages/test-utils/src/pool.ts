import { Pool } from "pg";

export function createTestPool(): Pool {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    user: process.env.POSTGRES_USER || "casino",
    password: process.env.POSTGRES_PASSWORD || "casino_dev_password",
    database: process.env.POSTGRES_DB || "fantasy_casino",
  });

  const { types } = require("pg");
  types.setTypeParser(20, (val: string) => Number(val));

  return pool;
}
