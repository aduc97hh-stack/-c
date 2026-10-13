// Configuration preflight only: never prints values or contacts a remote project.
import { isIP } from "node:net";
const env = process.env;
const errors = new Set();
const required = ["GAMI_DEPLOY_ENVIRONMENT", "GAMI_APP_URL", "SUPABASE_PROJECT_REF", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
for (const name of required) if (!env[name]?.trim()) errors.add(`missing:${name}`);
if (!["staging", "production"].includes(env.GAMI_DEPLOY_ENVIRONMENT)) errors.add("invalid:environment");
if (env.VERCEL_ENV && !["preview", "production"].includes(env.VERCEL_ENV)) errors.add("invalid:hosting_environment");
if (env.VERCEL_ENV && ((env.VERCEL_ENV === "production") !== (env.GAMI_DEPLOY_ENVIRONMENT === "production"))) errors.add("mismatch:hosting_environment");
function httpsOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/" || !url.hostname.includes(".") || !/^[a-z0-9.-]+$/.test(url.hostname) || isIP(url.hostname) || /\.(localhost|local|internal)$/.test(url.hostname)) return null;
    return url;
  } catch { return null; }
}
const app = httpsOrigin(env.GAMI_APP_URL);
if (!app) errors.add("invalid:app_origin");
const supabase = httpsOrigin(env.NEXT_PUBLIC_SUPABASE_URL);
if (!supabase || supabase.hostname !== `${env.SUPABASE_PROJECT_REF}.supabase.co`) errors.add("mismatch:supabase_project_origin");
if (!/^[a-z0-9]{20}$/.test(env.SUPABASE_PROJECT_REF ?? "")) errors.add("invalid:project_ref");
function validKey(key, role) {
  const prefix = role === "anon" ? "sb_publishable_" : "sb_secret_";
  if (key?.startsWith(prefix)) return key.length > prefix.length + 20;
  try {
    const parts = key.split(".");
    if (parts.length !== 3 || !parts[2]) return false;
    // Claims validate metadata/project mixups, not JWT signature authenticity.
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    return claims.role === role && claims.ref === env.SUPABASE_PROJECT_REF && Number.isFinite(claims.exp) && claims.exp > Date.now() / 1000;
  } catch { return false; }
}
if (!validKey(env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "anon")) errors.add("invalid:public_key_role_or_project");
if (!validKey(env.SUPABASE_SERVICE_ROLE_KEY, "service_role")) errors.add("invalid:server_key_role_or_project");
if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY === env.SUPABASE_SERVICE_ROLE_KEY) errors.add("invalid:keys_identical");
for (const name of Object.keys(env)) if (name.startsWith("NEXT_PUBLIC_") && env[name] && (/SECRET|PASSWORD|SERVICE_ROLE/.test(name) || env[name] === env.SUPABASE_SERVICE_ROLE_KEY || env[name].startsWith("sb_secret_"))) errors.add(`forbidden_public_binding:${name}`);
if (env.GAMI_SEED_PASSWORD || (env.GAMI_ALLOW_DEMO_SEED && env.GAMI_ALLOW_DEMO_SEED !== "no")) errors.add("forbidden:seed_in_web_environment");
console.info(JSON.stringify({ event: "deployment_preflight", status: errors.size ? "FAIL" : "PASS", errors: [...errors], scope: "configuration_metadata_only" }));
if (errors.size) process.exitCode = 1;
