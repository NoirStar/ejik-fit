"use client";

import {
  BookmarkSimple,
  ChatCircle,
  Heart,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  addLocalPostComment,
  EMPTY_SOCIAL_INTERACTIONS,
  MAX_LOCAL_COMMENT_LENGTH,
  readSocialInteractions,
  subscribeSocialInteractions,
  togglePostReaction,
  togglePostSave,
  type LocalPostComment,
  type SocialInteractions,
} from "@/lib/social-interactions";

import type { MockPostComment } from "./mock-post-details";
import type { SocialMetrics } from "./types";
import styles from "./post-detail-actions.module.css";

type PostDetailActionsProps = {
  contentKind?: "mock" | "local";
  postId: string;
  postTitle: string;
  metrics: SocialMetrics;
  sampleComments: MockPostComment[];
};

function formatLocalCommentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "이 브라우저에서 작성";
  return `${new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date)} 작성`;
}
function LocalComment({ comment }: { comment: LocalPostComment }) {
  return (
    <li className={styles.comment} data-local="true">
      <span className={styles.avatar} data-tone="violet" aria-hidden="true">
        나
      </span>
      <div>
        <header>
          <strong>나</strong>
          <span>{formatLocalCommentDate(comment.createdAt)}</span>
        </header>
        <p>{comment.body}</p>
        <small>이 브라우저에만 저장된 댓글</small>
      </div>
    </li>
  );
}

export function PostDetailActions({
  contentKind = "mock",
  postId,
  postTitle,
  metrics,
  sampleComments,
}: PostDetailActionsProps) {
  const isLocalPost = contentKind === "local";
  const [interactions, setInteractions] = useState<SocialInteractions>(
    EMPTY_SOCIAL_INTERACTIONS,
  );
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    setInteractions(readSocialInteractions());
    return subscribeSocialInteractions(setInteractions);
  }, []);

  const reacted = interactions.reactedPostIds.includes(postId);
  const saved = interactions.savedPostIds.includes(postId);
  const localComments = useMemo(
    () => interactions.commentsByPostId[postId] ?? [],
    [interactions.commentsByPostId, postId],
  );

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    setAnnouncement("");
    if (!body) {
      setError("댓글 내용을 입력해 주세요.");
      return;
    }
    if (body.length > MAX_LOCAL_COMMENT_LENGTH) {
      setError(`댓글은 ${MAX_LOCAL_COMMENT_LENGTH}자까지 입력할 수 있습니다.`);
      return;
    }

    const result = addLocalPostComment(postId, body);
    setInteractions(result.state);
    if (!result.comment) {
      setError("브라우저 저장소를 사용할 수 없습니다.");
      return;
    }
    setDraft("");
    setError("");
    setAnnouncement("이 브라우저에 댓글을 저장했습니다.");
  }

  return (
    <section aria-label="글 반응과 댓글" className={styles.root}>
      <div className={styles.actionBar}>
        <button
          aria-label={`${postTitle} ${reacted ? "공감 취소" : "공감"}`}
          aria-pressed={reacted}
          data-active={reacted ? "true" : undefined}
          onClick={() => setInteractions(togglePostReaction(postId))}
          type="button"
        >
          <Heart aria-hidden="true" size={20} weight={reacted ? "fill" : "regular"} />
          <span>공감 {metrics.reactions + (reacted ? 1 : 0)}</span>
        </button>
        <a href="#post-comment-form">
          <ChatCircle aria-hidden="true" size={20} />
          <span>댓글 {metrics.comments + localComments.length}</span>
        </a>
        <button
          aria-label={`${postTitle} ${saved ? "저장 해제" : "저장"}`}
          aria-pressed={saved}
          data-active={saved ? "true" : undefined}
          onClick={() => setInteractions(togglePostSave(postId))}
          type="button"
        >
          <BookmarkSimple
            aria-hidden="true"
            size={20}
            weight={saved ? "fill" : "regular"}
          />
          <span>저장 {metrics.saves + (saved ? 1 : 0)}</span>
        </button>
      </div>
      <p className={styles.metricNote}>
        {isLocalPost
          ? "반응과 댓글은 이 브라우저에만 저장됩니다."
          : "예시 반응 수에 이 브라우저에서 누른 반응만 더해 표시합니다."}
      </p>

      <section aria-labelledby="post-comments-title" className={styles.discussion}>
        <header className={styles.discussionHeader}>
          <div>
            <h2 id="post-comments-title">
              {isLocalPost ? "댓글" : "대표 예시 댓글"}
            </h2>
            <p>
              {isLocalPost
                ? "작성한 댓글도 서버로 전송되지 않고 이 브라우저에서만 유지됩니다."
                : "표시된 댓글은 정식 커뮤니티 연동 전에 제공되는 예시이며 실제 사용자가 작성한 댓글이 아닙니다."}
            </p>
          </div>
          <strong>{sampleComments.length + localComments.length}개 표시</strong>
        </header>

        <ul aria-label="댓글 목록" className={styles.comments}>
          {sampleComments.map((comment) => (
            <li className={styles.comment} key={comment.id}>
              <span
                aria-hidden="true"
                className={styles.avatar}
                data-tone={comment.authorTone}
              >
                {comment.authorName.slice(0, 1)}
              </span>
              <div>
                <header>
                  <strong>{comment.authorName}</strong>
                  <span>{comment.createdLabel}</span>
                </header>
                <small>{comment.authorHeadline}</small>
                <p>{comment.body}</p>
              </div>
            </li>
          ))}
          {localComments.map((comment) => (
            <LocalComment comment={comment} key={comment.id} />
          ))}
        </ul>

        <form
          aria-describedby="post-comment-storage-note"
          className={styles.form}
          id="post-comment-form"
          onSubmit={submitComment}
        >
          <label htmlFor="post-comment-body">댓글 내용</label>
          <textarea
            aria-describedby={error ? "post-comment-error" : undefined}
            id="post-comment-body"
            maxLength={MAX_LOCAL_COMMENT_LENGTH}
            onChange={(event) => {
              setDraft(event.target.value);
              if (error) setError("");
            }}
            placeholder="이 글에 대한 생각이나 경험을 남겨보세요."
            rows={4}
            value={draft}
          />
          <div className={styles.formFooter}>
            <div>
              <span>{draft.length}/{MAX_LOCAL_COMMENT_LENGTH}</span>
              <small id="post-comment-storage-note">
                커뮤니티 댓글은 로그인 후에도 이 브라우저에만 저장됩니다.
              </small>
            </div>
            <button type="submit">
              <PaperPlaneTilt aria-hidden="true" size={18} weight="bold" />
              댓글 등록
            </button>
          </div>
          {error && (
            <p id="post-comment-error" role="alert">
              {error}
            </p>
          )}
          {announcement && <p role="status">{announcement}</p>}
        </form>
      </section>
    </section>
  );
}
