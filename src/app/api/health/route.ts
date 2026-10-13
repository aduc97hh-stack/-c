import { NextResponse } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";
export async function GET() {
  const c = supabaseConfig();
  let ok = false;
  if (c) {
    try {
      const paths = ["/auth/v1/settings", "/rest/v1/", "/storage/v1/status"];
      const results = await Promise.all(
        paths.map((path) =>
          fetch(c.url + path, {
            headers: { apikey: c.key },
            cache: "no-store",
            signal: AbortSignal.timeout(4000),
          }),
        ),
      );
      ok = results.every((r) => r.ok);
    } catch {
      ok = false;
    }
  }
  return NextResponse.json(
    { status: ok ? "ok" : "unavailable" },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
