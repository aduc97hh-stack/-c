import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const ref = "abcdefghijklmnopqrst";
function run(overrides: Record<string, string> = {}, hosted = false) {
  const env = { NODE_ENV: "test" as const, GAMI_ALLOW_DEMO_SEED: "yes", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", ...overrides };
  return spawnSync(process.execPath, ["--input-type=module", "-e", `import {assertSeedTarget} from './scripts/seed-safety.mjs'; assertSeedTarget(process.env,{allowHostedStaging:${hosted}});`], { env, encoding: "utf8" });
}
test("Demo provisioning permits only the dedicated loopback stack by default", () => {
  assert.equal(run().status, 0);
  assert.equal(run({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54322" }).status, 1);
  assert.equal(run({ GAMI_ALLOW_DEMO_SEED: "no" }).status, 1);
});
test("Explicit production environment blocks provisioning even with demo permission", () => {
  assert.equal(run({ GAMI_DEPLOY_ENVIRONMENT: "production" }, true).status, 1);
  assert.equal(run({ VERCEL_ENV: "production" }, true).status, 1);
});
test("Hosted provisioning requires staging tag and matching explicit project allowlist", () => {
  const cfg = { GAMI_DEPLOY_ENVIRONMENT: "staging", GAMI_STAGING_PROJECT_REF: ref, SUPABASE_PROJECT_REF: ref, NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co` };
  assert.equal(run(cfg, true).status, 0);
  assert.equal(run(cfg).status, 1);
  assert.equal(run({ ...cfg, SUPABASE_PROJECT_REF: "wrong" }, true).status, 1);
  assert.equal(run({ ...cfg, GAMI_STAGING_PROJECT_REF: "" }, true).status, 1);
  assert.equal(run({ ...cfg, GAMI_DEPLOY_ENVIRONMENT: "production" }, true).status, 1);
});
test("Provisioning rejects credential-bearing, query and insecure hosted URLs", () => {
  for (const url of ["https://user:password@example.test", "http://example.test", "http://127.0.0.1:54321/?secret=x"])
    assert.equal(run({ NEXT_PUBLIC_SUPABASE_URL: url }, true).status, 1);
});
test("Every provisioning entrypoint blocks production before SDK writes", () => {
  for (const script of ["seed.mjs", "seed-teaching.mjs", "seed-staging.mjs"]) {
    const r = spawnSync(process.execPath, [`scripts/${script}`], {
      env: { NODE_ENV: "test", GAMI_DEPLOY_ENVIRONMENT: "production", GAMI_ALLOW_DEMO_SEED: "yes", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" },
      encoding: "utf8",
    });
    assert.equal(r.status, 1);
    assert.ok(r.stderr.includes("seed_blocked:production_environment"));
  }
});
