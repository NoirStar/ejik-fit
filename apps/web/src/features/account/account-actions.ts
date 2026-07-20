import type { AuthViewer } from "@/features/auth/use-auth-viewer";
import {
  readBrowserAccountState,
  type AccountCareerState,
} from "@/lib/account-state";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type QueryError = {
  code?: string;
  message?: string;
};

export type NotificationPreference = {
  enabled: boolean;
  supported: boolean;
};

export type AccountDataArchive = {
  format: "ejikfit-account-export";
  version: 1;
  exportedAt: string;
  account: {
    id: string;
    email: string;
  };
  browserCareerState: AccountCareerState;
  serverCareerState: unknown;
  savedJobSearches: unknown[];
  notifications: unknown[];
};

function clientOrThrow() {
  const client = createBrowserSupabaseClient();
  if (!client) {
    throw new Error("Supabase browser client is unavailable");
  }
  return client;
}

function isMissingPreferenceColumn(error: QueryError | null) {
  const message = error?.message?.toLocaleLowerCase("en-US") ?? "";
  return (
    (error?.code === "42703" || error?.code === "PGRST204") &&
    message.includes("job_notifications_enabled")
  );
}

export async function loadNotificationPreference(
  userId: string,
): Promise<NotificationPreference> {
  const { data, error } = await clientOrThrow()
    .from("user_career_states")
    .select("job_notifications_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (isMissingPreferenceColumn(error)) {
    return { enabled: true, supported: false };
  }
  if (error) throw error;

  const enabled =
    data &&
    typeof data === "object" &&
    "job_notifications_enabled" in data &&
    typeof data.job_notifications_enabled === "boolean"
      ? data.job_notifications_enabled
      : true;
  return { enabled, supported: true };
}

export async function saveNotificationPreference(
  userId: string,
  enabled: boolean,
) {
  const { error } = await clientOrThrow()
    .from("user_career_states")
    .upsert(
      {
        user_id: userId,
        job_notifications_enabled: enabled,
        updated_at: new Date().toISOString(),
      },
      { defaultToNull: false, onConflict: "user_id" },
    );
  if (error) throw error;
}

export async function createAccountDataArchive(
  viewer: AuthViewer,
): Promise<AccountDataArchive> {
  const client = clientOrThrow();
  const [careerState, savedSearches, notifications] = await Promise.all([
    client
      .from("user_career_states")
      .select("*")
      .eq("user_id", viewer.id)
      .maybeSingle(),
    client
      .from("user_saved_job_searches")
      .select("*")
      .eq("user_id", viewer.id)
      .order("created_at", { ascending: true }),
    client
      .from("user_notifications")
      .select("*")
      .eq("user_id", viewer.id)
      .order("created_at", { ascending: true }),
  ]);

  const error =
    careerState.error ?? savedSearches.error ?? notifications.error;
  if (error) throw error;

  return {
    format: "ejikfit-account-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    account: {
      id: viewer.id,
      email: viewer.email,
    },
    browserCareerState: readBrowserAccountState(),
    serverCareerState: careerState.data,
    savedJobSearches: savedSearches.data ?? [],
    notifications: notifications.data ?? [],
  };
}

export function downloadAccountDataArchive(archive: AccountDataArchive) {
  const blob = new Blob([JSON.stringify(archive, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `ejikfit-data-${archive.exportedAt.slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function deleteCurrentAccount() {
  const client = clientOrThrow();
  const { error } = await client.rpc("delete_current_user");
  if (error) throw error;

  await client.auth.signOut({ scope: "local" });
}
