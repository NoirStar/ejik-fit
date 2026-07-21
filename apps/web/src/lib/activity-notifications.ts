export type JobActivityNotificationMetadata = {
  companySlug: string;
  followedCompany: boolean;
  savedSearchIds: string[];
  savedSearchNames: string[];
};

export type CommunityActivityNotificationMetadata =
  | {
      action: "comment";
      actorId: string;
      postId: string;
      commentId: string;
    }
  | {
      action: "follow";
      actorId: string;
    };

export type ActivityNotificationMetadata =
  | JobActivityNotificationMetadata
  | CommunityActivityNotificationMetadata;

type ActivityNotificationBase = {
  id: string;
  userId: string;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};

export type ActivityNotification =
  | (ActivityNotificationBase & {
      kind: "job";
      metadata: JobActivityNotificationMetadata;
    })
  | (ActivityNotificationBase & {
      kind: "community";
      metadata: CommunityActivityNotificationMetadata;
    });

export type ActivityNotificationRow = {
  id: unknown;
  user_id: unknown;
  kind: unknown;
  title: unknown;
  body: unknown;
  href: unknown;
  metadata: unknown;
  read_at: unknown;
  created_at: unknown;
};

function stringArray(value: unknown, maximum: number) {
  if (
    !Array.isArray(value) ||
    value.length > maximum ||
    value.some((item) => typeof item !== "string")
  ) {
    return null;
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function jobMetadataFromValue(
  value: unknown,
): JobActivityNotificationMetadata | null {
  const metadata = record(value);
  if (!metadata) return null;
  const savedSearchIds = stringArray(metadata.saved_search_ids, 10);
  const savedSearchNames = stringArray(metadata.saved_search_names, 10);
  if (
    typeof metadata.company_slug !== "string" ||
    typeof metadata.followed_company !== "boolean" ||
    !savedSearchIds ||
    !savedSearchNames
  ) {
    return null;
  }
  return {
    companySlug: metadata.company_slug,
    followedCompany: metadata.followed_company,
    savedSearchIds,
    savedSearchNames,
  };
}

function communityMetadataFromValue(
  value: unknown,
): CommunityActivityNotificationMetadata | null {
  const metadata = record(value);
  if (!metadata) return null;
  const actorId = nonEmptyString(metadata.actor_id);
  if (!actorId) return null;

  if (metadata.action === "follow") {
    return { action: "follow", actorId };
  }
  if (metadata.action !== "comment") return null;
  const postId = nonEmptyString(metadata.post_id);
  const commentId = nonEmptyString(metadata.comment_id);
  return postId && commentId
    ? { action: "comment", actorId, postId, commentId }
    : null;
}

function validDate(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function safeInternalHref(value: unknown) {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
  );
}

export function activityNotificationFromRow(
  row: ActivityNotificationRow,
): ActivityNotification | null {
  if (
    typeof row.id !== "string" ||
    !row.id ||
    typeof row.user_id !== "string" ||
    !row.user_id ||
    typeof row.title !== "string" ||
    !row.title ||
    typeof row.body !== "string" ||
    !row.body ||
    !safeInternalHref(row.href) ||
    (row.read_at !== null && !validDate(row.read_at)) ||
    !validDate(row.created_at)
  ) {
    return null;
  }

  const base: ActivityNotificationBase = {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    href: row.href as string,
    readAt: row.read_at as string | null,
    createdAt: row.created_at as string,
  };

  if (row.kind === "job") {
    const metadata = jobMetadataFromValue(row.metadata);
    return metadata ? { ...base, kind: "job", metadata } : null;
  }
  if (row.kind !== "community") return null;
  const metadata = communityMetadataFromValue(row.metadata);
  if (!metadata) return null;
  if (
    metadata.action === "comment" &&
    base.href !== `/posts/${metadata.postId}`
  ) {
    return null;
  }
  if (metadata.action === "follow") {
    if (base.href !== "/career/questions" && base.href !== "/career/my-posts") {
      return null;
    }
    base.href = "/career/questions";
  }
  return { ...base, kind: "community", metadata };
}

export function notificationReason(notification: ActivityNotification) {
  if (notification.kind === "community") {
    return notification.metadata.action === "comment"
      ? "커뮤니티 · 새 댓글"
      : "커뮤니티 · 새 팔로워";
  }

  const names = notification.metadata.savedSearchNames;
  if (names.length > 0 && notification.metadata.followedCompany) {
    return `저장 검색 · ${names[0]} · 관심 기업`;
  }
  if (names.length > 0) {
    return names.length > 1
      ? `저장 검색 · ${names[0]} 외 ${names.length - 1}개`
      : `저장 검색 · ${names[0]}`;
  }
  return notification.metadata.followedCompany
    ? "관심 기업 새 공고"
    : "새 공고";
}
