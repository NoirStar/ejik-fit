import { describe, expect, it } from "vitest";

import { CommunityDataError } from "@/lib/community-contract";

import {
  mapCommunityCommentRow,
  mapCommunityFollowRows,
  mapCommunityPostMembershipRows,
  mapCommunityPostRow,
} from "./community-mapper";

const AUTHOR_ID = "11111111-1111-4111-8111-111111111111";
const VIEWER_ID = "22222222-2222-4222-8222-222222222222";
const POST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMMENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const postRow = {
  id: POST_ID,
  author_id: AUTHOR_ID,
  category: "커리어 질문",
  title: "서버에 저장된 질문",
  body: "공개 프로필과 함께 읽는 커뮤니티 본문입니다.",
  tags: ["Python", "백엔드"],
  reaction_count: 3,
  comment_count: 2,
  save_count: 1,
  created_at: "2026-07-21T01:02:03.000Z",
  updated_at: "2026-07-21T02:03:04.000Z",
  author: { user_id: AUTHOR_ID, nickname: "커리어곰" },
};

describe("community row mapper", () => {
  it("maps explicit public post and comment fields", () => {
    expect(mapCommunityPostRow(postRow)).toEqual({
      id: POST_ID,
      author: { id: AUTHOR_ID, nickname: "커리어곰" },
      category: "커리어 질문",
      title: "서버에 저장된 질문",
      body: "공개 프로필과 함께 읽는 커뮤니티 본문입니다.",
      tags: ["Python", "백엔드"],
      metrics: { reactions: 3, comments: 2, saves: 1 },
      createdAt: "2026-07-21T01:02:03.000Z",
      updatedAt: "2026-07-21T02:03:04.000Z",
    });

    expect(
      mapCommunityCommentRow({
        id: COMMENT_ID,
        post_id: POST_ID,
        author_id: VIEWER_ID,
        body: "계정에 저장된 댓글입니다.",
        created_at: "2026-07-21T03:04:05.000Z",
        updated_at: "2026-07-21T03:04:05.000Z",
        author: { user_id: VIEWER_ID, nickname: null },
      }),
    ).toEqual({
      id: COMMENT_ID,
      postId: POST_ID,
      author: { id: VIEWER_ID, nickname: null },
      body: "계정에 저장된 댓글입니다.",
      createdAt: "2026-07-21T03:04:05.000Z",
      updatedAt: "2026-07-21T03:04:05.000Z",
    });
  });

  it("rejects malformed counters, relationships, and tags", () => {
    for (const malformed of [
      { ...postRow, reaction_count: -1 },
      {
        ...postRow,
        author: { user_id: VIEWER_ID, nickname: "다른 사용자" },
      },
      { ...postRow, tags: ["Python", "python"] },
    ]) {
      expect(() => mapCommunityPostRow(malformed)).toThrow(CommunityDataError);
    }
  });

  it("keeps private membership rows scoped to the requested viewer", () => {
    expect(
      mapCommunityPostMembershipRows(
        [{ post_id: POST_ID, user_id: VIEWER_ID }],
        VIEWER_ID,
      ),
    ).toEqual([POST_ID]);
    expect(
      mapCommunityFollowRows(
        [{ follower_id: VIEWER_ID, followed_id: AUTHOR_ID }],
        VIEWER_ID,
      ),
    ).toEqual([AUTHOR_ID]);

    expect(() =>
      mapCommunityPostMembershipRows(
        [{ post_id: POST_ID, user_id: AUTHOR_ID }],
        VIEWER_ID,
      ),
    ).toThrow(CommunityDataError);
  });
});
