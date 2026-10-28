import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { env } from "../../config/env.js";
import { DatabaseSchema } from "./types.js";

const { Pool } = pg;

export const db = new Kysely<DatabaseSchema>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: env.DATABASE_URL,
      max: env.DATABASE_MAX_CONNECTIONS,
    }),
  }),
});
