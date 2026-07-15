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
import { useEffect, useState } from "react";

import { localCommunityPostToFeedItem } from "@/features/home-feed/model";
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
}: {
  interactions: SocialInteractions;
  onCancelDelete(): void;
  onConfirmDelete(): void;
  onRequestDelete(): void;
  pendingDelete: boolean;
  post: LocalCommunityPost;
}) {
  const item = localCommunityPostToFeedItem(post);
  const titleId = `authored-question-${item.id}-title`;
  const reacted = interactions.reactedPostIds.includes(item.id);
  const saved = interactions.savedPostIds.includes(item.id);
  const commentCount = interactions.commentsByPostId[item.id]?.length ?? 0;

  return (
    <article aria-labelledby={titleId} className={styles.questionCard}>
      <div className={styles.cardTopline}>
        <div>
          <span>이 브라우저에서 작성</span>
          <time dateTime={post.createdAt}>{item.createdLabel}</time>
        </div>
        <button
          aria-expanded={pendingDelete}
          aria-label={`${item.title} 삭제`}
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
          <Link href={item.href}>{item.title}</Link>
        </h2>
        <p>{item.body}</p>
      </div>

      {item.tags.length > 0 && (
        <ul aria-label={`${item.title} 태그`} className={styles.tags}>
          {item.tags.map((tag) => (
            <li key={tag}>
              <Link href={buildSearchScopeHref(tag, "community")}>{tag}</Link>
            </li>
          ))}
        </ul>
      )}

      <div aria-label={`${item.title} 브라우저 반응`} className={styles.facts}>
        <span data-active={reacted ? "true" : undefined}>
          <Heart aria-hidden="true" size={16} weight={reacted ? "fill" : "regular"} />
          공감 {reacted ? 1 : 0}
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
        <Link href={item.href}>
          상세 보기
          <ArrowRight aria-hidden="true" size={15} weight="bold" />
        </Link>
      </div>

      {pendingDelete && (
        <div className={styles.deleteConfirm} role="group" aria-label={`${item.title} 삭제 확인`}>
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

export function AuthoredQuestions() {
  const [hydrated, setHydrated] = useState(false);
  const [posts, setPosts] = useState<LocalCommunityPost[]>([]);
  const [interactions, setInteractions] = useState<SocialInteractions>(
    EMPTY_SOCIAL_INTERACTIONS,
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setPosts(readLocalCommunityPosts());
    setInteractions(readSocialInteractions());
    setHydrated(true);
    const unsubscribePosts = subscribeLocalCommunityPosts(setPosts);
    const unsubscribeInteractions = subscribeSocialInteractions(setInteractions);
    return () => {
      unsubscribePosts();
      unsubscribeInteractions();
    };
  }, []);

  function deleteQuestion(post: LocalCommunityPost) {
    const result = deleteLocalCommunityPost(post.id);
    setPosts(result.posts);
    if (result.status !== "removed") {
      setAnnouncement("");
      setError(
        result.status === "interactions_failed"
          ? "댓글과 반응을 정리하지 못해 삭제를 중단했습니다."
          : "질문을 브라우저에서 삭제하지 못했습니다.",
      );
      return;
    }

    removeRecentCommunityTopic(post.id);
    setPendingDeleteId(null);
    setError("");
    setAnnouncement(`${post.title}을 이 브라우저에서 삭제했습니다.`);
  }

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>내 커리어 · 브라우저 커뮤니티</p>
          <h1>내 질문</h1>
          <p className={styles.description}>
            이 브라우저에서 직접 작성한 커리어 질문을 다시 확인합니다.
            서버 계정과 동기화되지 않습니다.
          </p>
        </div>
        <div className={styles.introActions}>
          {hydrated && <span>이 브라우저에 {posts.length}개 저장</span>}
          <Link href="/?compose=1">
            <NotePencil aria-hidden="true" size={17} weight="bold" />
            새 질문 작성
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
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {!hydrated ? (
          <div className={styles.loading} role="status">
            <p>질문을 불러오는 중입니다.</p>
          </div>
        ) : posts.length > 0 ? (
          <div className={styles.questionList}>
            {posts.map((post) => (
              <QuestionCard
                interactions={interactions}
                key={post.id}
                onCancelDelete={() => setPendingDeleteId(null)}
                onConfirmDelete={() => deleteQuestion(post)}
                onRequestDelete={() => {
                  setAnnouncement("");
                  setError("");
                  setPendingDeleteId(post.id);
                }}
                pendingDelete={pendingDeleteId === post.id}
                post={post}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div>
              <NotePencil aria-hidden="true" size={24} weight="bold" />
            </div>
            <h2>이 브라우저에서 작성한 질문이 없습니다.</h2>
            <p>커리어 고민이나 공고를 보며 생긴 질문을 홈 피드에 남겨보세요.</p>
            <Link href="/?compose=1">
              첫 질문 작성
              <ArrowRight aria-hidden="true" size={16} weight="bold" />
            </Link>
          </div>
        )}

        <p className={styles.storageNote}>
          글과 반응은 현재 브라우저의 로컬 저장소에만 남습니다. 브라우저 데이터를
          지우면 복구할 수 없습니다.
        </p>
      </section>
    </main>
  );
}
