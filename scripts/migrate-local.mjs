import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
const sql = (input) =>
  execFileSync(
    "docker",
    [
      "compose",
      "--env-file",
      ".local/stack.env",
      "-f",
      "scripts/local/compose.yml",
      "exec",
      "-T",
      "db",
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-At",
    ],
    { input, encoding: "utf8" },
  );
sql(readFileSync("scripts/local/auth-contract.sql", "utf8"));
sql(
  "create schema if not exists gami_migrations; revoke all on schema gami_migrations from public; create table if not exists gami_migrations.applied(name text primary key,applied_at timestamptz not null default now());",
);
for (const name of readdirSync("supabase/migrations")
  .filter((n) => n.endsWith(".sql"))
  .sort()) {
  if (!/^\d+_[a-z0-9_]+\.sql$/.test(name))
    throw new Error("Invalid migration filename");
  if (
    sql(`select name from gami_migrations.applied where name='${name}';`).trim()
  )
    continue;
  const migration = readFileSync(`supabase/migrations/${name}`, "utf8")
    .replace(/^begin;\s*/i, "")
    .replace(/commit;\s*$/i, "");
  sql(
    `begin;\n${migration}\ninsert into gami_migrations.applied(name) values('${name}');\ncommit;`,
  );
  console.info(`Applied ${name}`);
}
sql("notify pgrst, 'reload schema';");
