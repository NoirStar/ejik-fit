import type { SupabaseClient } from "@supabase/supabase-js";

import {
  activityNotificationFromRow,
  type ActivityNotification,
  type ActivityNotificationRow,
} from "@/lib/activity-notifications";

const TABLE = "user_notifications";
const COLUMNS = [
  "id",
  "user_id",
  "kind",
  "title",
  "body",
  "href",
  "metadata",
  "read_at",
  "created_at",
].join(",");

export type NotificationStore = {
  list(userId: string): Promise<ActivityNotification[]>;
  markRead(userId: string, id: string, readAt: string): Promise<void>;
  markAllRead(userId: string, readAt: string): Promise<void>;
};

function parseRow(value: unknown) {
  const notification = activityNotificationFromRow(
    value as ActivityNotificationRow,
  );
  if (!notification) throw new Error("Notification row is malformed.");
  return notification;
}

export function createSupabaseNotificationStore(
  client: SupabaseClient,
): NotificationStore {
  return {
    async list(userId) {
      const { data, error } = await client
        .from(TABLE)
        .select(COLUMNS)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      if (!Array.isArray(data)) {
        throw new Error("Notification rows are malformed.");
      }
      return data.map(parseRow);
    },

    async markRead(userId, id, readAt) {
      const { error } = await client
        .from(TABLE)
        .update({ read_at: readAt })
        .eq("user_id", userId)
        .eq("id", id);
      if (error) throw error;
    },

    async markAllRead(userId, readAt) {
      const { error } = await client
        .from(TABLE)
        .update({ read_at: readAt })
        .eq("user_id", userId)
        .is("read_at", null);
      if (error) throw error;
    },
  };
}
