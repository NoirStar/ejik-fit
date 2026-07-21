import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { createSupabaseUserProfileStore } from "./user-profile-store";

function createClient({
  loadData = { user_id: "user-1", nickname: "커리어곰" },
  loadError = null,
  updateError = null,
}: {
  loadData?: unknown;
  loadError?: unknown;
  updateError?: unknown;
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: loadData,
    error: loadError,
  });
  const loadEq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq: loadEq }));
  const updateEq = vi.fn().mockResolvedValue({ error: updateError });
  const update = vi.fn(() => ({ eq: updateEq }));
  const from = vi.fn(() => ({ select, update }));

  return {
    client: { from } as unknown as SupabaseClient,
    from,
    loadEq,
    select,
    update,
    updateEq,
  };
}

describe("user profile store", () => {
  it("loads only the public profile fields", async () => {
    const query = createClient();
    const store = createSupabaseUserProfileStore(query.client);

    await expect(store.load("user-1")).resolves.toEqual({
      userId: "user-1",
      nickname: "커리어곰",
    });
    expect(query.from).toHaveBeenCalledWith("user_profiles");
    expect(query.select).toHaveBeenCalledWith("user_id,nickname");
    expect(query.loadEq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("updates only the nickname and timestamp for its owner", async () => {
    const query = createClient();
    const store = createSupabaseUserProfileStore(query.client);

    await store.updateNickname("user-1", "새닉네임");

    expect(query.update).toHaveBeenCalledWith({
      nickname: "새닉네임",
      updated_at: expect.any(String),
    });
    expect(query.updateEq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("rejects malformed rows and database errors", async () => {
    const malformedStore = createSupabaseUserProfileStore(
      createClient({
        loadData: { user_id: "user-1", nickname: 42 },
      }).client,
    );
    const databaseError = { code: "PGRST500" };
    const failingStore = createSupabaseUserProfileStore(
      createClient({ loadError: databaseError }).client,
    );

    await expect(malformedStore.load("user-1")).rejects.toThrow(
      "User profile row is malformed.",
    );
    await expect(failingStore.load("user-1")).rejects.toBe(databaseError);
  });
});
