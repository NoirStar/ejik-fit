import { describe, expect, it } from "vitest";

import {
  activityNotificationFromRow,
  notificationReason,
} from "./activity-notifications";

describe("activity notifications", () => {
  it("parses server-created community comment notifications", () => {
    const notification = activityNotificationFromRow({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      user_id: "11111111-1111-4111-8111-111111111111",
      kind: "community",
      title: "새 댓글이 달렸어요",
      body: "서버정원님이 댓글을 남겼습니다.",
      href: "/posts/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      metadata: {
        action: "comment",
        actor_id: "22222222-2222-4222-8222-222222222222",
        post_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        comment_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
      read_at: null,
      created_at: "2026-07-21T04:00:00.000Z",
    });

    expect(notification).toMatchObject({
      kind: "community",
      metadata: {
        action: "comment",
        actorId: "22222222-2222-4222-8222-222222222222",
        postId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        commentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
    });
    expect(notification && notificationReason(notification)).toBe(
      "커뮤니티 · 새 댓글",
    );
  });

  it("rejects community notifications with unsafe or mismatched metadata", () => {
    const base = {
      id: "notification-1",
      user_id: "viewer-1",
      kind: "community",
      title: "새 팔로워",
      body: "새 팔로워가 생겼습니다.",
      href: "/career/questions",
      read_at: null,
      created_at: "2026-07-21T04:00:00.000Z",
    };

    expect(
      activityNotificationFromRow({
        ...base,
        href: "https://attacker.example",
        metadata: { action: "follow", actor_id: "actor-1" },
      }),
    ).toBeNull();
    expect(
      activityNotificationFromRow({
        ...base,
        metadata: { action: "comment", actor_id: "actor-1" },
      }),
    ).toBeNull();
  });
});
