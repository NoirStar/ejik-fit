import type { SupabaseClient } from "@supabase/supabase-js";

import {
  savedJobSearchFromRow,
  savedJobSearchQueryKey,
  type SavedJobSearch,
  type SavedJobSearchFilters,
  type SavedJobSearchRow,
} from "@/lib/saved-job-searches";

const TABLE = "user_saved_job_searches";
const COLUMNS = [
  "id",
  "user_id",
  "name",
  "query_text",
  "query_key",
  "category",
  "career_type",
  "is_enabled",
  "last_checked_at",
  "created_at",
  "updated_at",
].join(",");

export type SavedJobSearchStore = {
  list(userId: string): Promise<SavedJobSearch[]>;
  insert(
    userId: string,
    filters: SavedJobSearchFilters,
    name: string,
    now: string,
  ): Promise<SavedJobSearch>;
  update(
    userId: string,
    id: string,
    patch: Partial<
      Pick<SavedJobSearch, "name" | "enabled" | "lastCheckedAt">
    >,
  ): Promise<SavedJobSearch>;
  remove(userId: string, id: string): Promise<void>;
  markChecked(
    userId: string,
    ids: string[],
    evaluatedAt: string,
  ): Promise<void>;
};

function parseRow(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Saved job search row is malformed.");
  }

  const item = savedJobSearchFromRow(value as SavedJobSearchRow);
  if (!item) throw new Error("Saved job search row is malformed.");
  return item;
}

export function sanitizeSavedJobSearchIds(ids: string[]) {
  return Array.from(
    new Set(ids.map((id) => id.trim()).filter(Boolean)),
  );
}

export function createSupabaseSavedJobSearchStore(
  client: SupabaseClient,
): SavedJobSearchStore {
  return {
    async list(userId) {
      const { data, error } = await client
        .from(TABLE)
        .select(COLUMNS)
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      if (!Array.isArray(data)) {
        throw new Error("Saved job search rows are malformed.");
      }
      return data.map(parseRow);
    },

    async insert(userId, filters, name, now) {
      const { data, error } = await client
        .from(TABLE)
        .insert({
          id: crypto.randomUUID(),
          user_id: userId,
          name,
          query_text: filters.query,
          query_key: savedJobSearchQueryKey(filters),
          category: filters.category,
          career_type: filters.careerType,
          is_enabled: true,
          last_checked_at: now,
          created_at: now,
          updated_at: now,
        })
        .select(COLUMNS)
        .single();
      if (error) throw error;
      return parseRow(data);
    },

    async update(userId, id, patch) {
      const values: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (patch.name !== undefined) values.name = patch.name;
      if (patch.enabled !== undefined) values.is_enabled = patch.enabled;
      if (patch.lastCheckedAt !== undefined) {
        values.last_checked_at = patch.lastCheckedAt;
      }

      const { data, error } = await client
        .from(TABLE)
        .update(values)
        .eq("user_id", userId)
        .eq("id", id)
        .select(COLUMNS)
        .single();
      if (error) throw error;
      return parseRow(data);
    },

    async remove(userId, id) {
      const { error } = await client
        .from(TABLE)
        .delete()
        .eq("user_id", userId)
        .eq("id", id);
      if (error) throw error;
    },

    async markChecked(userId, ids, evaluatedAt) {
      const checkpointIds = sanitizeSavedJobSearchIds(ids);
      if (checkpointIds.length === 0) return;

      const { error } = await client
        .from(TABLE)
        .update({
          last_checked_at: evaluatedAt,
          updated_at: evaluatedAt,
        })
        .eq("user_id", userId)
        .in("id", checkpointIds);
      if (error) throw error;
    },
  };
}
