"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
} from "react";

import type { AuthViewer, AuthViewerStatus } from "./use-auth-viewer";

type AuthViewerContextValue = {
  error: string;
  viewer: AuthViewer | null;
  ready: boolean;
  status: AuthViewerStatus;
};

const AuthViewerContext = createContext<AuthViewerContextValue>({
  error: "",
  viewer: null,
  ready: false,
  status: "loading",
});

type AuthViewerProviderProps = {
  children: ReactNode;
  error?: string;
  ready: boolean;
  status?: AuthViewerStatus;
  viewer: AuthViewer | null;
};

export function AuthViewerProvider({
  children,
  error = "",
  ready,
  status,
  viewer,
}: AuthViewerProviderProps) {
  const resolvedStatus =
    status ?? (!ready ? "loading" : viewer ? "authenticated" : "unauthenticated");
  const value = useMemo(
    () => ({ error, ready, status: resolvedStatus, viewer }),
    [error, ready, resolvedStatus, viewer],
  );

  return (
    <AuthViewerContext.Provider value={value}>
      {children}
    </AuthViewerContext.Provider>
  );
}

export function useAuthViewerContext() {
  return useContext(AuthViewerContext);
}
