// Provisioning safety only. Project purpose still requires operator verification.
export function assertSeedTarget(env, { allowHostedStaging = false } = {}) {
  if (env.GAMI_ALLOW_DEMO_SEED !== "yes") throw new Error("seed_blocked:explicit_demo_permission_required");
  if (env.GAMI_DEPLOY_ENVIRONMENT === "production" || env.VERCEL_ENV === "production") throw new Error("seed_blocked:production_environment");
  let url;
  try { url = new URL(env.NEXT_PUBLIC_SUPABASE_URL); } catch { throw new Error("seed_blocked:invalid_project_url"); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("seed_blocked:invalid_project_url");
  if (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname) && url.port === "54321") return;
  if (!allowHostedStaging) throw new Error("seed_blocked:legacy_seed_local_only");
  const ref = env.GAMI_STAGING_PROJECT_REF;
  if (env.GAMI_DEPLOY_ENVIRONMENT !== "staging" || !/^[a-z0-9]{20}$/.test(ref ?? "") || env.SUPABASE_PROJECT_REF !== ref || url.origin !== `https://${ref}.supabase.co`) throw new Error("seed_blocked:verified_staging_allowlist_required");
}
