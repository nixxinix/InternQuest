/**
 * Writes supabase/seed.sql from the TypeScript catalogs.
 * Run with: npm run db:seed
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { buildSeedSql } from "@/lib/db/seedSql";

const file = path.join(process.cwd(), "supabase", "seed.sql");
writeFileSync(file, buildSeedSql(), "utf8");
console.log(`Wrote ${path.relative(process.cwd(), file)}`);
