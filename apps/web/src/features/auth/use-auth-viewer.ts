"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

import { clearBrowserAccountState } from "@/lib/account-state";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export type AuthViewer = {
  id: string;
  email: string;
};

export type AuthViewerStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "error";

const AUTH_LOOKUP_ERROR =
  "로그인 상태를 확인하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.";

function viewerFromUser(user: User | null): AuthViewer | null {
  const email = user?.email?.trim();
  return user && email ? { id: user.id, email } : null;
}

function isMissingAuthSession(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as Record<string, unknown>;
  return (
    candidate.name === "AuthSessionMissingError" ||
    candidate.code === "session_not_found" ||
    (typeof candidate.message === "string" &&
      /auth session missing/i.test(candidate.message))
  );
}

export function useAuthViewer() {
  const [viewer, setViewer] = useState<AuthViewer | null>(null);
  const [status, setStatus] = useState<AuthViewerStatus>("loading");
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const ready = status !== "loading";

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setError(AUTH_LOOKUP_ERROR);
      setStatus("error");
      return;
    }

    let active = true;
    const readyFallback = window.setTimeout(() => {
      if (!active) return;
      setError(AUTH_LOOKUP_ERROR);
      setStatus("error");
    }, 3_000);
    void supabase.auth
      .getUser()
      .then(({ data, error: authError }) => {
        if (!active) return;
        window.clearTimeout(readyFallback);
        if (authError && !isMissingAuthSession(authError)) {
          setViewer(null);
          setError(AUTH_LOOKUP_ERROR);
          setStatus("error");
          return;
        }
        const nextViewer = viewerFromUser(data.user);
        setViewer(nextViewer);
        setError("");
        setStatus(nextViewer ? "authenticated" : "unauthenticated");
      })
      .catch(() => {
        if (!active) return;
        window.clearTimeout(readyFallback);
        setViewer(null);
        setError(AUTH_LOOKUP_ERROR);
        setStatus("error");
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      window.clearTimeout(readyFallback);
      const nextViewer = viewerFromUser(session?.user ?? null);
      setViewer(nextViewer);
      setError("");
      setStatus(nextViewer ? "authenticated" : "unauthenticated");
    });

    return () => {
      active = false;
      window.clearTimeout(readyFallback);
      data.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setError("로그아웃 설정을 확인하지 못했습니다.");
      return false;
    }

    setSigningOut(true);
    setError("");
    const { error: authError } = await supabase.auth.signOut();
    setSigningOut(false);
    if (authError) {
      setError("로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return false;
    }

    clearBrowserAccountState();
    setViewer(null);
    setStatus("unauthenticated");
    return true;
  }, []);

  return { viewer, ready, status, signingOut, error, signOut };
}
