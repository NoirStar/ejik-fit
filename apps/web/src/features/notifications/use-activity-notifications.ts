"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AuthViewer } from "@/features/auth/use-auth-viewer";
import type { ActivityNotification } from "@/lib/activity-notifications";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

import {
  createSupabaseNotificationStore,
  type NotificationStore,
} from "./notification-store";

type NotificationState =
  | { status: "idle" | "loading"; items: ActivityNotification[] }
  | { status: "ready"; items: ActivityNotification[] }
  | { status: "error"; items: ActivityNotification[] };

export type ActivityNotificationsController = {
  state: NotificationState;
  unreadCount: number;
  reload(): Promise<void>;
  markRead(id: string): Promise<boolean>;
  markAllRead(): Promise<boolean>;
};

const IDLE_STATE: NotificationState = { status: "idle", items: [] };

export function useActivityNotifications(
  viewer: AuthViewer | null,
  injectedStore?: NotificationStore,
): ActivityNotificationsController {
  const viewerId = viewer?.id;
  const [state, setState] = useState<NotificationState>(IDLE_STATE);
  const stateRef = useRef(state);
  const viewerRef = useRef(viewerId);
  const request = useRef(0);
  const productionStore = useRef<
    NotificationStore | null | undefined
  >(undefined);
  stateRef.current = state;
  viewerRef.current = viewerId;

  const resolveStore = useCallback(() => {
    if (injectedStore) return injectedStore;
    if (productionStore.current !== undefined) {
      return productionStore.current;
    }
    const client = createBrowserSupabaseClient();
    productionStore.current = client
      ? createSupabaseNotificationStore(client)
      : null;
    return productionStore.current;
  }, [injectedStore]);

  const load = useCallback(
    async (keepItems: boolean) => {
      const currentRequest = request.current + 1;
      request.current = currentRequest;
      if (!viewerId) {
        setState(IDLE_STATE);
        return;
      }
      const previous = keepItems ? stateRef.current.items : [];
      setState({ status: "loading", items: previous });
      const store = resolveStore();
      if (!store) {
        if (request.current === currentRequest) {
          setState({ status: "error", items: previous });
        }
        return;
      }
      try {
        const items = await store.list(viewerId);
        if (request.current === currentRequest) {
          setState({ status: "ready", items });
        }
      } catch {
        if (request.current === currentRequest) {
          setState({ status: "error", items: previous });
        }
      }
    },
    [resolveStore, viewerId],
  );

  useEffect(() => {
    void load(false);
    return () => {
      request.current += 1;
    };
  }, [load]);

  useEffect(() => {
    if (!viewerId) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [load, viewerId]);

  const markRead = useCallback(
    async (id: string) => {
      if (!viewerId) return false;
      const item = stateRef.current.items.find(
        (notification) => notification.id === id,
      );
      if (!item || item.readAt) return Boolean(item);
      const readAt = new Date().toISOString();
      setState((current) => ({
        ...current,
        items: current.items.map((notification) =>
          notification.id === id
            ? { ...notification, readAt }
            : notification,
        ),
      }));
      const store = resolveStore();
      try {
        if (!store) throw new Error("Notification store is unavailable");
        await store.markRead(viewerId, id, readAt);
        return viewerRef.current === viewerId;
      } catch {
        if (viewerRef.current !== viewerId) return false;
        setState((current) => ({
          status: "error",
          items: current.items.map((notification) =>
            notification.id === id
              ? { ...notification, readAt: null }
              : notification,
          ),
        }));
        return false;
      }
    },
    [resolveStore, viewerId],
  );

  const markAllRead = useCallback(async () => {
    if (!viewerId || !stateRef.current.items.some((item) => !item.readAt)) {
      return false;
    }
    const readAt = new Date().toISOString();
    const previous = stateRef.current.items;
    setState((current) => ({
      ...current,
      items: current.items.map((notification) => ({
        ...notification,
        readAt: notification.readAt ?? readAt,
      })),
    }));
    const store = resolveStore();
    try {
      if (!store) throw new Error("Notification store is unavailable");
      await store.markAllRead(viewerId, readAt);
      return viewerRef.current === viewerId;
    } catch {
      if (viewerRef.current !== viewerId) return false;
      setState({ status: "error", items: previous });
      return false;
    }
  }, [resolveStore, viewerId]);

  const reload = useCallback(async () => {
    await load(true);
  }, [load]);
  const unreadCount = useMemo(
    () => state.items.filter((notification) => !notification.readAt).length,
    [state.items],
  );

  return { state, unreadCount, reload, markRead, markAllRead };
}
