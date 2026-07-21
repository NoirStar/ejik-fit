import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "user_profiles";
const COLUMNS = "user_id,nickname";

export type UserProfile = {
  userId: string;
  nickname: string | null;
};

export type UserProfileStore = {
  load(userId: string): Promise<UserProfile>;
  updateNickname(userId: string, nickname: string): Promise<void>;
};

function parseProfile(value: unknown, userId: string): UserProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("User profile row is malformed.");
  }

  const row = value as Record<string, unknown>;
  if (
    row.user_id !== userId ||
    (row.nickname !== null && typeof row.nickname !== "string")
  ) {
    throw new Error("User profile row is malformed.");
  }

  return {
    userId,
    nickname: row.nickname as string | null,
  };
}

export function createSupabaseUserProfileStore(
  client: SupabaseClient,
): UserProfileStore {
  return {
    async load(userId) {
      const { data, error } = await client
        .from(TABLE)
        .select(COLUMNS)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return parseProfile(data, userId);
    },

    async updateNickname(userId, nickname) {
      const { error } = await client
        .from(TABLE)
        .update({
          nickname,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      if (error) throw error;
    },
  };
}
