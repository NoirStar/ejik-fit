"use client";

import {
  ArrowRight,
  BookmarkSimple,
  ChatCircle,
  CheckCircle,
  Heart,
  NotePencil,
  ShieldCheck,
  Trash,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuthViewerContext } from "@/features/auth/auth-viewer-context";
import type { CommunityStore } from "@/features/community/community-store";
import { useCommunityFeed } from "@/features/community/use-community-feed";
import {
  localCommunityPostToFeedItem,
  serverCommunityPostToFeedItem,
} from "@/features/home-feed/model";
import type { CommunityPostFeedItem } from "@/features/home-feed/types";
import { buildSearchScopeHref } from "@/features/search/model";
import {
  deleteLocalCommunityPost,
  readLocalCommunityPosts,
  subscribeLocalCommunityPosts,
  type LocalCommunityPost,
} from "@/lib/local-community-posts";
import { removeRecentCommunityTopic } from "@/lib/recent-community-topics";
import {
  EMPTY_SOCIAL_INTERACTIONS,
  readSocialInteractions,
  subscribeSocialInteractions,
  type SocialInteractions,
} from "@/lib/social-interactions";

import styles from "./authored-questions.module.css";

function QuestionCard({
  interactions,
  onCancelDelete,
  onConfirmDelete,
  onRequestDelete,
  pendingDelete,
  post,
  serverSaved,
}: {
  interactions: SocialInteractions;
  onCancelDelete(): void;
  onConfirmDelete(): void;
  onRequestDelete(): void;
  pendingDelete: boolean;
  post: CommunityPostFeedItem;
  serverSaved: boolean;
}) {
  const titleId = `authored-question-${post.id}-title`;
  const local = post.source === "local";
  const reacted = local && interactions.reactedPostIds.includes(post.id);
  const saved = local
    ? interactions.savedPostIds.includes(post.id)
    : serverSaved;
  const commentCount = local
    ? interactions.commentsByPostId[post.id]?.length ?? 0
    : post.metrics.comments;
  const reactionCount = local ? (reacted ? 1 : 0) : post.metrics.reactions;

  return (
    <article aria-labelledby={titleId} className={styles.questionCard}>
      <div className={styles.cardTopline}>
        <div>
          <span>
            {post.category} · {local ? "이 브라우저에서 작성" : "계정에 작성"}
          </span>
          <time dateTime={post.createdAt}>{post.createdLabel}</time>
        </div>
        <button
          aria-expanded={pendingDelete}
          aria-label={`${post.title} 삭제`}
          className={styles.deleteButton}
          onClick={onRequestDelete}
          type="button"
        >
          <Trash aria-hidden="true" size={16} />
          삭제
        </button>
      </div>

      <div className={styles.cardCopy}>
        <h2 id={titleId}>
          <Link href={post.href}>{post.title}</Link>
        </h2>
        <p>{post.body}</p>
      </div>

      {post.tags.length > 0 && (
        <ul aria-label={`${post.title} 태그`} className={styles.tags}>
          {post.tags.map((tag) => (
            <li key={tag}>
              <Link href={buildSearchScopeHref(tag, "community")}>{tag}</Link>
            </li>
          ))}
        </ul>
      )}

      <div aria-label={`${post.title} 반응`} className={styles.facts}>
        <span data-active={reactionCount > 0 ? "true" : undefined}>
          <Heart
            aria-hidden="true"
            size={16}
            weight={reactionCount > 0 ? "fill" : "regular"}
          />
          공감 {reactionCount}
        </span>
        <span>
          <ChatCircle aria-hidden="true" size={16} />
          댓글 {commentCount}
        </span>
        <span data-active={saved ? "true" : undefined}>
          <BookmarkSimple
            aria-hidden="true"
            size={16}
            weight={saved ? "fill" : "regular"}
          />
          {saved ? "저장됨" : "저장 안 함"}
        </span>
        <Link href={post.href}>
          상세 보기
          <ArrowRight aria-hidden="true" size={15} weight="bold" />
        </Link>
      </div>

      {pendingDelete && (
        <div
          aria-label={`${post.title} 삭제 확인`}
          className={styles.deleteConfirm}
          role="group"
        >
          <p>삭제하면 댓글과 반응도 함께 지워집니다.</p>
          <div>
            <button onClick={onCancelDelete} type="button">
              삭제 취소
            </button>
            <button onClick={onConfirmDelete} type="button">
              정말 삭제
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export function AuthoredQuestions({
  communityStore,
}: {
  communityStore?: CommunityStore;
} = {}) {
  const { ready: authReady, viewer } = useAuthViewerContext();
  const community = useCommunityFeed({
    authReady,
    authorId: viewer?.id,
    enabled: Boolean(viewer),
    limit: 50,
    store: communityStore,
    viewer,
  });
  const [hydrated, setHydrated] = useState(false);
  const [localPosts, setLocalPosts] = useState<LocalCommunityPost[]>([]);
  const [interactions, setInteractions] = useState<SocialInteractions>(
    EMPTY_SOCIAL_INTERACTIONS,
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLocalPosts(readLocalCommunityPosts());
    setInteractions(readSocialInteractions());
    setHydrated(true);
    const unsubscribePosts = subscribeLocalCommunityPosts(setLocalPosts);
    const unsubscribeInteractions = subscribeSocialInteractions(setInteractions);
    return () => {
      unsubscribePosts();
      unsubscribeInteractions();
    };
  }, []);

  const posts = useMemo(
    () =>
      [
        ...localPosts.map((post) => localCommunityPostToFeedItem(post)),
        ...community.state.posts.map((post) =>
          serverCommunityPostToFeedItem(post),
        ),
      ].sort(
        (left, right) =>
          Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
          left.id.localeCompare(right.id),
      ),
    [community.state.posts, localPosts],
  );

  async function deleteQuestion(post: CommunityPostFeedItem) {
    if (post.source === "server") {
      const deleted = await community.deletePost(post.id);
      if (!deleted) {
        setAnnouncement("");
        setError("글을 계정에서 삭제하지 못했습니다. 다시 시도해주세요.");
        return;
      }
      removeRecentCommunityTopic(post.id);
      setPendingDeleteId(null);
      setError("");
      setAnnouncement(`${post.title}을 계정에서 삭제했습니다.`);
      return;
    }

    const result = deleteLocalCommunityPost(post.id);
    setLocalPosts(result.posts);
    if (result.status !== "removed") {
      setAnnouncement("");
      setError(
        result.status === "interactions_failed"
          ? "댓글과 반응을 정리하지 못해 삭제를 중단했습니다."
          : "글을 브라우저에서 삭제하지 못했습니다.",
      );
      return;
    }

    removeRecentCommunityTopic(post.id);
    setPendingDeleteId(null);
    setError("");
    setAnnouncement(`${post.title}을 이 브라우저에서 삭제했습니다.`);
  }

  const loading =
    !hydrated ||
    Boolean(viewer && community.state.status === "loading" && posts.length === 0);
  const visibleError = error ||
    (community.state.status === "error" ? community.state.error : "");

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>
            내 커리어 · {viewer ? "계정 커뮤니티" : "브라우저 커뮤니티"}
          </p>
          <h1>내 글</h1>
          <p className={styles.description}>
            {viewer
              ? "내 계정으로 작성한 질문, 커리어 고민과 면접 후기를 모든 기기에서 다시 확인합니다."
              : "지금 작성한 질문, 커리어 고민과 면접 후기는 이 브라우저에 보관되며, 로그인하면 계정으로 안전하게 옮겨집니다."}
          </p>
        </div>
        <div className={styles.introActions}>
          {hydrated && (
            <span>
              {viewer ? `계정에 ${posts.length}개 작성` : `이 브라우저에 ${posts.length}개 저장`}
            </span>
          )}
          <Link href="/?compose=1">
            <NotePencil aria-hidden="true" size={17} weight="bold" />
            새 글 작성
          </Link>
        </div>
      </header>

      <section aria-labelledby="authored-question-list-title" className={styles.collection}>
        <div className={styles.collectionHeader}>
          <div>
            <p>작성 기록</p>
            <h2 id="authored-question-list-title">최근 작성한 순서</h2>
          </div>
          <ShieldCheck aria-hidden="true" size={21} weight="fill" />
        </div>

        {announcement && (
          <p aria-live="polite" className={styles.success} role="status">
            <CheckCircle aria-hidden="true" size={17} weight="fill" />
            {announcement}
          </p>
        )}
        {visibleError && (
          <p className={styles.error} role="alert">
            {visibleError}
          </p>
        )}

        {loading ? (
          <div className={styles.loading} role="status">
            <p>작성한 글을 불러오는 중입니다.</p>
          </div>
        ) : posts.length > 0 ? (
          <div className={styles.questionList}>
            {posts.map((post) => (
              <QuestionCard
                interactions={interactions}
                key={post.id}
                onCancelDelete={() => setPendingDeleteId(null)}
                onConfirmDelete={() => void deleteQuestion(post)}
                onRequestDelete={() => {
                  setAnnouncement("");
                  setError("");
                  setPendingDeleteId(post.id);
                }}
                pendingDelete={pendingDeleteId === post.id}
                post={post}
                serverSaved={community.state.viewerState.savedPostIds.includes(
                  post.id,
                )}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div>
              <NotePencil aria-hidden="true" size={24} weight="bold" />
            </div>
            <h2>
              {viewer
                ? "계정에 작성한 글이 없습니다."
                : "이 브라우저에서 작성한 글이 없습니다."}
            </h2>
            <p>질문이나 커리어 고민, 면접에서 배운 점을 홈 피드에 남겨보세요.</p>
            <Link href="/?compose=1">
              첫 글 작성
              <ArrowRight aria-hidden="true" size={16} weight="bold" />
            </Link>
          </div>
        )}

        <p className={styles.storageNote}>
          {viewer
            ? "계정 글과 반응은 이직핏 서버에 저장됩니다. 삭제한 글은 복구할 수 없습니다."
            : "로그인 전에는 글과 반응이 현재 브라우저에 보관됩니다. 로그인하면 계정으로 옮겨지며, 옮기기 전 브라우저 데이터를 지우면 복구할 수 없습니다."}
        </p>
      </section>
    </main>
  );
}
