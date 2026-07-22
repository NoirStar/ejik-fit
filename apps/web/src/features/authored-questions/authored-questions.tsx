"use client";

import {
  ArrowRight,
  BookmarkSimple,
  ChatCircle,
  CheckCircle,
  Heart,
  NotePencil,
  ShieldCheck,
  SignIn,
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

import styles from "./authored-questions.module.css";

type DeleteControls = {
  onCancelDelete(): void;
  onConfirmDelete(): void;
  onRequestDelete(): void;
  pendingDelete: boolean;
};

function DeleteConfirmation({
  label,
  onCancelDelete,
  onConfirmDelete,
}: {
  label: string;
  onCancelDelete(): void;
  onConfirmDelete(): void;
}) {
  return (
    <div
      aria-label={`${label} 삭제 확인`}
      className={styles.deleteConfirm}
      role="group"
    >
      <p>삭제하면 글에 남아 있는 댓글과 반응도 함께 지워집니다.</p>
      <div>
        <button onClick={onCancelDelete} type="button">
          삭제 취소
        </button>
        <button onClick={onConfirmDelete} type="button">
          정말 삭제
        </button>
      </div>
    </div>
  );
}

function AccountQuestionCard({
  onCancelDelete,
  onConfirmDelete,
  onRequestDelete,
  pendingDelete,
  post,
  saved,
}: DeleteControls & {
  post: CommunityPostFeedItem;
  saved: boolean;
}) {
  const titleId = `authored-question-${post.id}-title`;

  return (
    <article aria-labelledby={titleId} className={styles.questionCard}>
      <div className={styles.cardTopline}>
        <div>
          <span>{post.category} · 계정에 작성</span>
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
        <span data-active={post.metrics.reactions > 0 ? "true" : undefined}>
          <Heart
            aria-hidden="true"
            size={16}
            weight={post.metrics.reactions > 0 ? "fill" : "regular"}
          />
          공감 {post.metrics.reactions}
        </span>
        <span>
          <ChatCircle aria-hidden="true" size={16} />
          댓글 {post.metrics.comments}
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
        <DeleteConfirmation
          label={post.title}
          onCancelDelete={onCancelDelete}
          onConfirmDelete={onConfirmDelete}
        />
      )}
    </article>
  );
}

function LegacyRecoveryCard({
  onCancelDelete,
  onConfirmDelete,
  onRequestDelete,
  pendingDelete,
  post,
}: DeleteControls & { post: CommunityPostFeedItem }) {
  const titleId = `legacy-question-${post.id}-title`;

  return (
    <article aria-labelledby={titleId} className={styles.questionCard}>
      <div className={styles.cardTopline}>
        <div>
          <span>{post.category} · 이전 기기 저장</span>
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
              <span>{tag}</span>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.recoveryActions}>
        <Link href={post.href}>
          복구 내용 확인
          <ArrowRight aria-hidden="true" size={15} weight="bold" />
        </Link>
        <span>서버 활동 및 개수에 포함되지 않음</span>
      </div>
      {pendingDelete && (
        <DeleteConfirmation
          label={post.title}
          onCancelDelete={onCancelDelete}
          onConfirmDelete={onConfirmDelete}
        />
      )}
    </article>
  );
}

export function AuthoredQuestions({
  communityStore,
}: {
  communityStore?: CommunityStore;
} = {}) {
  const {
    error: authError,
    ready: authReady,
    status: authStatus,
    viewer,
  } = useAuthViewerContext();
  const community = useCommunityFeed({
    authReady,
    authorId: viewer?.id,
    enabled: Boolean(viewer),
    limit: 20,
    store: communityStore,
    viewer,
  });
  const [hydrated, setHydrated] = useState(false);
  const [localPosts, setLocalPosts] = useState<LocalCommunityPost[]>([]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLocalPosts(readLocalCommunityPosts());
    setHydrated(true);
    return subscribeLocalCommunityPosts(setLocalPosts);
  }, []);

  const accountPosts = useMemo(
    () =>
      community.state.posts.map((post) =>
        serverCommunityPostToFeedItem(post),
      ),
    [community.state.posts],
  );
  const recoveryPosts = useMemo(
    () => localPosts.map((post) => localCommunityPostToFeedItem(post)),
    [localPosts],
  );

  function requestDelete(postId: string) {
    setAnnouncement("");
    setError("");
    setPendingDeleteId(postId);
  }

  async function deleteAccountQuestion(post: CommunityPostFeedItem) {
    const deleted = await community.deletePost(post.id);
    if (!deleted) {
      setAnnouncement("");
      setError("글을 계정에서 삭제하지 못했습니다. 다시 시도해 주세요.");
      return;
    }
    removeRecentCommunityTopic(post.id);
    setPendingDeleteId(null);
    setError("");
    setAnnouncement(`${post.title}을 계정에서 삭제했습니다.`);
  }

  function deleteLegacyQuestion(post: CommunityPostFeedItem) {
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

  const visibleError =
    error ||
    (authStatus === "error" ? authError : "") ||
    community.state.actionError ||
    (community.state.status === "error" ? community.state.error : "");
  const accountLoading = Boolean(
    viewer && community.state.status === "loading" && accountPosts.length === 0,
  );

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>내 커리어 · 계정 커뮤니티</p>
          <h1>내 글</h1>
          <p className={styles.description}>
            계정에 게시된 질문과 경험만 내 글로 집계합니다. 이전 브라우저에
            남은 글은 아래 복구 영역에서 따로 확인할 수 있습니다.
          </p>
        </div>
        <div className={styles.introActions}>
          {viewer ? (
            <span>
              계정 글 {accountPosts.length}
              {community.state.nextCursor ? "+" : ""}개 불러옴
            </span>
          ) : (
            <span>계정 연결 전</span>
          )}
          <Link href="/?compose=1">
            <NotePencil aria-hidden="true" size={17} weight="bold" />
            새 글 작성
          </Link>
        </div>
      </header>

      <section
        aria-labelledby="account-authored-question-list-title"
        className={styles.collection}
      >
        <div className={styles.collectionHeader}>
          <div>
            <p>실제 서버 기록</p>
            <h2 id="account-authored-question-list-title">계정에 작성한 글</h2>
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

        {!authReady || accountLoading ? (
          <div className={styles.loading} role="status">
            <p>계정에 작성한 글을 불러오는 중입니다.</p>
          </div>
        ) : authStatus === "error" ? (
          <div className={styles.emptyState}>
            <div>
              <ShieldCheck aria-hidden="true" size={24} weight="bold" />
            </div>
            <h2>로그인 상태를 확인하지 못했습니다.</h2>
            <p>브라우저의 복구 글은 유지됩니다. 연결을 확인한 뒤 새로고침해 주세요.</p>
          </div>
        ) : !viewer ? (
          <div className={styles.emptyState}>
            <div>
              <SignIn aria-hidden="true" size={24} weight="bold" />
            </div>
            <h2>계정에 연결하면 내 글을 모든 기기에서 볼 수 있습니다.</h2>
            <p>로그인 전 브라우저 글은 서버 게시물로 집계하지 않습니다.</p>
            <Link href="/login?next=%2Fcareer%2Fquestions">
              로그인하고 내 글 보기
              <ArrowRight aria-hidden="true" size={16} weight="bold" />
            </Link>
          </div>
        ) : accountPosts.length > 0 ? (
          <>
            <div className={styles.questionList}>
              {accountPosts.map((post) => (
                <AccountQuestionCard
                  key={post.id}
                  onCancelDelete={() => setPendingDeleteId(null)}
                  onConfirmDelete={() => void deleteAccountQuestion(post)}
                  onRequestDelete={() => requestDelete(post.id)}
                  pendingDelete={pendingDeleteId === post.id}
                  post={post}
                  saved={community.state.viewerState.savedPostIds.includes(
                    post.id,
                  )}
                />
              ))}
            </div>
            {community.state.nextCursor && (
              <button
                className={styles.loadMore}
                disabled={community.state.loadingMore}
                onClick={() => void community.loadMore()}
                type="button"
              >
                {community.state.loadingMore
                  ? "내 글 불러오는 중..."
                  : "내 글 더 보기"}
              </button>
            )}
          </>
        ) : (
          <div className={styles.emptyState}>
            <div>
              <NotePencil aria-hidden="true" size={24} weight="bold" />
            </div>
            <h2>계정에 작성한 글이 없습니다.</h2>
            <p>질문이나 커리어 고민, 면접에서 배운 점을 홈 피드에 남겨보세요.</p>
            <Link href="/?compose=1">
              첫 글 작성
              <ArrowRight aria-hidden="true" size={16} weight="bold" />
            </Link>
          </div>
        )}

        <p className={styles.storageNote}>
          계정 글의 본문·댓글·반응은 이직핏 서버에 저장됩니다. 삭제한 글은
          복구할 수 없습니다.
        </p>
      </section>

      {hydrated && recoveryPosts.length > 0 && (
        <section
          aria-labelledby="legacy-authored-question-list-title"
          className={`${styles.collection} ${styles.recoveryCollection}`}
        >
          <div className={styles.collectionHeader}>
            <div>
              <p>현재 브라우저에서만 확인</p>
              <h2 id="legacy-authored-question-list-title">
                이전 기기 저장 글
              </h2>
            </div>
            <span className={styles.recoveryCount}>
              복구할 글 {recoveryPosts.length}개
            </span>
          </div>
          <p className={styles.recoveryNote}>
            서버에 게시된 활동이 아닙니다. 로그인하면 계정 이전을 시도하며,
            원문을 확인하거나 이 브라우저에서 삭제할 수 있습니다.
          </p>
          <div className={styles.questionList}>
            {recoveryPosts.map((post) => (
              <LegacyRecoveryCard
                key={post.id}
                onCancelDelete={() => setPendingDeleteId(null)}
                onConfirmDelete={() => deleteLegacyQuestion(post)}
                onRequestDelete={() => requestDelete(post.id)}
                pendingDelete={pendingDeleteId === post.id}
                post={post}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
