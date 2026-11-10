import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isProtectedPath, loginRedirect } from "@/lib/auth/routes";
import { supabaseConfig } from "@/lib/supabase/env";

/**
 * Runs before the intern app pages (Next 16 "proxy", formerly middleware):
 *  1. Refreshes the Supabase session cookie when the access token is about to expire.
 *  2. Sends signed-out visitors from app screens to /login?next=...
 * In the design preview (no Supabase keys), it does nothing.
 *
 * This is a convenience, not the security boundary: every server action
 * re-checks the user, and row-level security guards the data.
 */
export async function proxy(request: NextRequest) {
  const config = supabaseConfig();
  if (!config) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        // Responses that set auth cookies must never be cached and served to someone else.
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Verifies the token (and refreshes it through setAll when needed).
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  if (!signedIn && isProtectedPath(pathname)) {
    const target = new URL(loginRedirect(pathname, search), request.url);
    const redirect = NextResponse.redirect(target);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}

export const config = {
  // Only pages that read the session. Static files, images, and other public pages skip this.
  matcher: [
    "/",
    "/listings/:path*",
    "/home/:path*",
    "/search/:path*",
    "/quest-log/:path*",
    "/tips/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/leaderboard/:path*",
    "/start/:path*",
    "/login/:path*",
  ],
};
