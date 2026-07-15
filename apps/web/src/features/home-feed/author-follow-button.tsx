"use client";

import { UserCheck, UserPlus } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import {
  EMPTY_SOCIAL_INTERACTIONS,
  readSocialInteractions,
  subscribeSocialInteractions,
  toggleAuthorFollow,
  type SocialInteractions,
} from "@/lib/social-interactions";

import styles from "./author-follow-button.module.css";

export function AuthorFollowButton({
  authorId,
  authorName,
}: {
  authorId: string;
  authorName: string;
}) {
  const [hydrated, setHydrated] = useState(false);
  const [interactions, setInteractions] = useState<SocialInteractions>(
    EMPTY_SOCIAL_INTERACTIONS,
  );
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    setInteractions(readSocialInteractions());
    setHydrated(true);
    return subscribeSocialInteractions(setInteractions);
  }, []);

  const followed = interactions.followedAuthorIds.includes(authorId);

  function handleFollow() {
    const next = toggleAuthorFollow(authorId);
    const nextFollowed = next.followedAuthorIds.includes(authorId);
    setInteractions(next);
    setAnnouncement(
      nextFollowed === followed
        ? `${authorName} 팔로우 상태를 저장하지 못했습니다.`
        : `${authorName} ${nextFollowed ? "팔로우를 시작했습니다." : "팔로우를 해제했습니다."}`,
    );
  }

  return (
    <div className={styles.root}>
      <button
        aria-label={`${authorName} ${followed ? "팔로우 해제" : "팔로우"}`}
        aria-pressed={followed}
        data-active={followed ? "true" : undefined}
        disabled={!hydrated}
        onClick={handleFollow}
        type="button"
      >
        {followed ? (
          <UserCheck aria-hidden="true" size={16} weight="fill" />
        ) : (
          <UserPlus aria-hidden="true" size={16} weight="bold" />
        )}
        {followed ? "팔로잉" : "팔로우"}
      </button>
      <span aria-live="polite" className={styles.srOnly}>
        {announcement}
      </span>
    </div>
  );
}
