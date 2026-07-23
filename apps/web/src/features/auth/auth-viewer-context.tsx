"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
} from "react";

import type { AuthViewer, AuthViewerStatus } from "./use-auth-viewer";
import type { AccountSyncStatus } from "./use-account-state-sync";

type AuthViewerContextValue = {
  accountSyncStatus: AccountSyncStatus;
  error: string;
  viewer: AuthViewer | null;
  ready: boolean;
  status: AuthViewerStatus;
};

const AuthViewerContext = createContext<AuthViewerContextValue>({
  accountSyncStatus: "local",
  error: "",
  viewer: null,
  ready: false,
  status: "loading",
});

type AuthViewerProviderProps = {
  accountSyncStatus?: AccountSyncStatus;
  children: ReactNode;
  error?: string;
  ready: boolean;
  status?: AuthViewerStatus;
  viewer: AuthViewer | null;
};

export function AuthViewerProvider({
  accountSyncStatus = "local",
  children,
  error = "",
  ready,
  status,
  viewer,
}: AuthViewerProviderProps) {
  const resolvedStatus =
    status ?? (!ready ? "loading" : viewer ? "authenticated" : "unauthenticated");
  const value = useMemo(
    () => ({ accountSyncStatus, error, ready, status: resolvedStatus, viewer }),
    [accountSyncStatus, error, ready, resolvedStatus, viewer],
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

export function accountStorageStatusCopy(status: AccountSyncStatus) {
  if (status === "syncing") {
    return { error: "", label: "계정에 저장 중…" };
  }
  if (status === "synced") {
    return { error: "", label: "계정에 저장됨" };
  }
  if (status === "error") {
    return {
      error: "계정에 저장하지 못했습니다.",
      label: "이 기기에 저장됨",
    };
  }
  return { error: "", label: "이 기기에 저장됨" };
}
