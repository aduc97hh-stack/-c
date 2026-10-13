import { readFileSync } from "node:fs";
const values = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .trim()
    .split("\n")
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
let ready = false;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const response = await fetch(
      `${values.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`,
      {
        headers: { apikey: values.NEXT_PUBLIC_SUPABASE_ANON_KEY },
        signal: AbortSignal.timeout(2000),
      },
    );
    if (
      response.ok &&
      (
        await fetch(`${values.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/status`, {
          headers: { apikey: values.NEXT_PUBLIC_SUPABASE_ANON_KEY },
          signal: AbortSignal.timeout(2000),
        })
      ).ok
    ) {
      ready = true;
      break;
    }
  } catch {
    /* Readiness retries are bounded; failure is reported below. */
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!ready)
  throw new Error(
    "Local Supabase Auth health check failed. Check Docker service status.",
  );
console.info("Local Auth is ready.");
