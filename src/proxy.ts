import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";

function loginRedirect(response: NextResponse, request: NextRequest) {
  const redirected = NextResponse.redirect(new URL("/login", request.url));
  redirected.headers.set("Cache-Control", "private, no-store");
  response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
  return redirected;
}

export async function proxy(request: NextRequest) {
  const protectedRoute =
    /^\/(admin|teacher|cskh|media|students|tasks|notifications)(?:\/|$)/.test(
      request.nextUrl.pathname,
    );
  const config = supabaseConfig();
  let response = NextResponse.next({ request });
  if (!config)
    return protectedRoute ? loginRedirect(response, request) : response;
  const client = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const {
    data: { user },
  } = await client.auth.getUser();
  if (protectedRoute && !user) return loginRedirect(response, request);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
