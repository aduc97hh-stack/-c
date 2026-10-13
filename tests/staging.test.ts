import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const ref = "abcdefghijklmnopqrst";
const jwt = (role: string, project = ref, exp = 4102444800) =>
  [Buffer.from("{}").toString("base64url"), Buffer.from(JSON.stringify({ role, ref: project, exp })).toString("base64url"), "synthetic-signature"].join(".");
const fixture = () => ({
  NODE_ENV: "test" as const,
  GAMI_DEPLOY_ENVIRONMENT: "staging",
  GAMI_APP_URL: "https://staging.gami.example",
  SUPABASE_PROJECT_REF: ref,
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("anon"),
  SUPABASE_SERVICE_ROLE_KEY: jwt("service_role"),
});
function run(overrides: Record<string, string> = {}) {
  const env = { ...fixture(), ...overrides };
  const r = spawnSync(process.execPath, ["scripts/check-deployment.mjs"], { env, encoding: "utf8" });
  assert.equal(r.error, undefined);
  assert.equal(r.stderr, "");
  // Even failed validation must never print either supplied credential.
  for (const value of [env.NEXT_PUBLIC_SUPABASE_ANON_KEY, env.SUPABASE_SERVICE_ROLE_KEY])
    if (value) assert.equal(r.stdout.includes(value), false);
  return { status: r.status, errors: JSON.parse(r.stdout).errors as string[] };
}
test("Hosted preflight accepts matching staging and production metadata", () => {
  assert.equal(run().status, 0);
  assert.equal(run({ GAMI_DEPLOY_ENVIRONMENT: "production", VERCEL_ENV: "production" }).status, 0);
  assert.equal(run({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_" + "a".repeat(30), SUPABASE_SERVICE_ROLE_KEY: "sb_secret_" + "b".repeat(30) }).status, 0);
});
test("Hosted preflight rejects local, HTTP, credential-bearing and redirect-shaped origins", () => {
  for (const origin of ["http://staging.gami.example", "https://localhost", "https://127.0.0.1", "https://*.gami.example", "https://user:password@staging.gami.example", "https://staging.gami.example/?next=https://foreign.example", "https://staging.gami.example/path"])
    assert.equal(run({ GAMI_APP_URL: origin }).status, 1);
});
test("Hosted preflight rejects project/key environment mixups and expiration", () => {
  assert.equal(run({ NEXT_PUBLIC_SUPABASE_URL: "https://other.supabase.co" }).status, 1);
  assert.equal(run({ SUPABASE_SERVICE_ROLE_KEY: jwt("service_role", "different-project") }).status, 1);
  assert.equal(run({ NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("anon", ref, 1) }).status, 1);
  assert.equal(run({ GAMI_DEPLOY_ENVIRONMENT: "staging", VERCEL_ENV: "production" }).status, 1);
  assert.equal(run({ VERCEL_ENV: "development" }).status, 1);
});
test("Hosted preflight blocks service role in public key and public secret bindings", () => {
  assert.equal(run({ NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("service_role") }).status, 1);
  assert.equal(run({ NEXT_PUBLIC_UPLOAD_SECRET: "synthetic-secret" }).status, 1);
  assert.equal(run({ NEXT_PUBLIC_OTHER_KEY: jwt("service_role") }).status, 1);
});
test("Hosted preflight excludes seed credentials/jobs from web runtime", () => {
  assert.equal(run({ GAMI_SEED_PASSWORD: "synthetic-password" }).status, 1);
  assert.equal(run({ GAMI_ALLOW_DEMO_SEED: "yes" }).status, 1);
});
test("Hosted preflight reports missing bindings by name without values", () => {
  const r = run({ SUPABASE_SERVICE_ROLE_KEY: "" });
  assert.equal(r.status, 1);
  assert.ok(r.errors.includes("missing:SUPABASE_SERVICE_ROLE_KEY"));
});
