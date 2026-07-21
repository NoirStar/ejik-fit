import { NextResponse, type NextRequest } from "next/server";

import { safeAuthNextPath } from "@/lib/auth/redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function privateRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = safeAuthNextPath(
    request.nextUrl.searchParams.get("next") ?? undefined,
  );
  const supabase = await createServerSupabaseClient();

  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return privateRedirect(new URL(nextPath, request.nextUrl.origin));
    }
  }

  const loginUrl = new URL("/login", request.nextUrl.origin);
  loginUrl.searchParams.set("error", "callback");
  loginUrl.searchParams.set("mode", "signin");
  loginUrl.searchParams.set("next", nextPath);
  return privateRedirect(loginUrl);
}
