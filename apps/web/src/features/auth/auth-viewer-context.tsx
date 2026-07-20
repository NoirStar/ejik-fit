"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
} from "react";

import type { AuthViewer } from "./use-auth-viewer";

type AuthViewerContextValue = {
  viewer: AuthViewer | null;
  ready: boolean;
};

const AuthViewerContext = createContext<AuthViewerContextValue>({
  viewer: null,
  ready: false,
});

export function AuthViewerProvider({
  children,
  ready,
  viewer,
}: AuthViewerContextValue & { children: ReactNode }) {
  const value = useMemo(() => ({ ready, viewer }), [ready, viewer]);

  return (
    <AuthViewerContext.Provider value={value}>
      {children}
    </AuthViewerContext.Provider>
  );
}

export function useAuthViewerContext() {
  return useContext(AuthViewerContext);
}
