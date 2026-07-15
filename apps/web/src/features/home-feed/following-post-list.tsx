import { ArrowRight, UserPlus } from "@phosphor-icons/react";
import Link from "next/link";

import { MOCK_SOCIAL_ITEMS } from "./mock-community";
import styles from "./home-feed.module.css";

const VISIBLE_FOLLOWING_POSTS = 2;

type FollowingPostListProps = {
  followedAuthorIds: string[];
  hydrated: boolean;
  onShowFollowing(): void;
  onShowRecommended(): void;
};

export function FollowingPostList({
  followedAuthorIds,
  hydrated,
  onShowFollowing,
  onShowRecommended,
}: FollowingPostListProps) {
  const followed = new Set(followedAuthorIds);
  const posts = MOCK_SOCIAL_ITEMS.filter((item) => followed.has(item.authorId))
    .sort(
      (left, right) =>
        Date.parse(right.createdAt) - Date.parse(left.createdAt),
    )
    .slice(0, VISIBLE_FOLLOWING_POSTS);

  return (
    <section
      aria-labelledby="following-posts-title"
      className={`${styles.railCard} ${styles.followingRailCard}`}
    >
      <div className={styles.railHeadingRow}>
        <h2 id="following-posts-title">팔로우 중인 예시 글</h2>
        <span>최대 2개</span>
      </div>

      {!hydrated ? (
        <p className={styles.followingEmpty}>팔로우 정보를 확인 중입니다.</p>
      ) : posts.length > 0 ? (
        <>
          <ul className={styles.followingPosts}>
            {posts.map((post) => (
              <li key={post.id}>
                <Link
                  aria-label={`${post.authorName}의 글: ${post.title}`}
                  href={post.href}
                >
                  <span
                    aria-hidden="true"
                    className={styles.followingAvatar}
                    data-tone={post.authorTone}
                  >
                    {post.authorName.slice(0, 1)}
                  </span>
                  <span className={styles.followingCopy}>
                    <span className={styles.followingMeta}>
                      <strong>{post.authorName}</strong>
                      <small>{post.createdLabel}</small>
                    </span>
                    <span className={styles.followingTitle}>{post.title}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <button
            className={styles.followingAction}
            onClick={onShowFollowing}
            type="button"
          >
            팔로잉 탭 보기
            <ArrowRight aria-hidden="true" size={14} weight="bold" />
          </button>
        </>
      ) : (
        <div className={styles.followingEmptyState}>
          <UserPlus aria-hidden="true" size={19} />
          <p>아직 팔로우한 예시 작성자가 없습니다.</p>
          <button
            className={styles.followingAction}
            onClick={onShowRecommended}
            type="button"
          >
            추천 탭에서 찾기
            <ArrowRight aria-hidden="true" size={14} weight="bold" />
          </button>
        </div>
      )}
    </section>
  );
}
