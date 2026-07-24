import type {
  CommunityPage,
  CommunityPost,
} from "@/lib/community-contract";

export type InitialCommunityFeed =
  | {
      status: "ready";
      page: CommunityPage<CommunityPost>;
    }
  | {
      status: "error";
      error: string;
    };
