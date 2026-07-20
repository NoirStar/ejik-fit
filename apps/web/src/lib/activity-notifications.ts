export type ActivityNotificationMetadata = {
  companySlug: string;
  followedCompany: boolean;
  savedSearchIds: string[];
  savedSearchNames: string[];
};

export type ActivityNotification = {
  id: string;
  userId: string;
  kind: "job";
  title: string;
  body: string;
  href: string;
  metadata: ActivityNotificationMetadata;
  readAt: string | null;
  createdAt: string;
};

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

function metadataFromValue(
  value: unknown,
): ActivityNotificationMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const metadata = value as Record<string, unknown>;
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

function validDate(value: unknown) {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value))
  );
}

export function activityNotificationFromRow(
  row: ActivityNotificationRow,
): ActivityNotification | null {
  const metadata = metadataFromValue(row.metadata);
  if (
    typeof row.id !== "string" ||
    !row.id ||
    typeof row.user_id !== "string" ||
    !row.user_id ||
    row.kind !== "job" ||
    typeof row.title !== "string" ||
    !row.title ||
    typeof row.body !== "string" ||
    !row.body ||
    typeof row.href !== "string" ||
    !row.href.startsWith("/") ||
    row.href.startsWith("//") ||
    !metadata ||
    (row.read_at !== null && !validDate(row.read_at)) ||
    !validDate(row.created_at)
  ) {
    return null;
  }
  return {
    id: row.id,
    userId: row.user_id,
    kind: "job",
    title: row.title,
    body: row.body,
    href: row.href,
    metadata,
    readAt: row.read_at as string | null,
    createdAt: row.created_at as string,
  };
}

export function notificationReason(
  notification: ActivityNotification,
) {
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
