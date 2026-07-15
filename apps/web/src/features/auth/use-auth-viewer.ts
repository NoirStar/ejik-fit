"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

import { clearBrowserAccountState } from "@/lib/account-state";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export type AuthViewer = {
  id: string;
  email: string;
};

function viewerFromUser(user: User | null): AuthViewer | null {
  const email = user?.email?.trim();
  return user && email ? { id: user.id, email } : null;
}

export function useAuthViewer() {
  const [viewer, setViewer] = useState<AuthViewer | null>(null);
  const [ready, setReady] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setReady(true);
      return;
    }

    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setViewer(viewerFromUser(data.user));
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setViewer(viewerFromUser(session?.user ?? null));
      setReady(true);
    });

    return () => {
      active = false;
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
      setError("로그아웃하지 못했습니다. 잠시 후 다시 시도해주세요.");
      return false;
    }

    clearBrowserAccountState();
    setViewer(null);
    return true;
  }, []);

  return { viewer, ready, signingOut, error, signOut };
}
