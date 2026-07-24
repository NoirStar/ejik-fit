import { createServerSupabaseClient } from "@/lib/supabase/server";

import type { InitialCommunityFeed } from "./community-feed-initial";
import {
  COMMUNITY_FAILURE_COPY,
  communityFailureMessage,
  createSupabaseCommunityStore,
} from "./community-store";

export async function loadInitialCommunityFeed(
  limit = 20,
): Promise<InitialCommunityFeed> {
  const client = await createServerSupabaseClient();
  if (!client) {
    return {
      status: "error",
      error: COMMUNITY_FAILURE_COPY.load,
    };
  }

  try {
    const page = await createSupabaseCommunityStore(client).listPostPage({
      limit,
    });
    return { status: "ready", page };
  } catch (error) {
    console.error("[community] server feed request failed", error);
    return {
      status: "error",
      error: communityFailureMessage(error, COMMUNITY_FAILURE_COPY.load),
    };
  }
}
