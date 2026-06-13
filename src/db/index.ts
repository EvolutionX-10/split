import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as authSchema from "./schema/auth";
import * as appSchema from "./schema/app";

const client = postgres(process.env.DATABASE_URL);
export const db = drizzle(client, { schema: { ...authSchema, ...appSchema } });
