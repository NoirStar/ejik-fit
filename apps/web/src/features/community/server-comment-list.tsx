"use client";

import {
  ArrowDown,
  PaperPlaneTilt,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import styles from "@/features/home-feed/post-detail-actions.module.css";
import {
  CommunityStoreError,
  MAX_COMMUNITY_COMMENT_LENGTH,
  normalizeCommunityText,
  type CommunityComment,
  type CommunityCursor,
} from "@/lib/community-contract";

import {
  COMMUNITY_FAILURE_COPY,
  type CommunityStore,
} from "./community-store";

const COMMENT_PAGE_SIZE = 30;

type CommentStore = Pick<
  CommunityStore,
  "createComment" | "deleteComment" | "listCommentPage" | "updateComment"
>;

type ServerCommentListProps = {
  onCountChange(delta: number): void;
  onLoginRequired?(): string | void;
  postId: string;
  store: CommentStore;
  totalCount: number;
  viewerId: string | null;
};

type LoadStatus = "error" | "loading" | "ready";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "작성 시각 확인 불가";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function compareComments(left: CommunityComment, right: CommunityComment) {
  return (
    Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
    right.id.localeCompare(left.id)
  );
}

function mergeComments(
  current: CommunityComment[],
  additions: CommunityComment[],
) {
  const comments = new Map(current.map((comment) => [comment.id, comment]));
  for (const comment of additions) comments.set(comment.id, comment);
  return Array.from(comments.values()).sort(compareComments);
}

export function ServerCommentList({
  onCountChange,
  onLoginRequired,
  postId,
  store,
  totalCount,
  viewerId,
}: ServerCommentListProps) {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [nextCursor, setNextCursor] = useState<CommunityCursor | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [pending, setPending] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editError, setEditError] = useState("");
  const request = useRef(0);
  const postIdRef = useRef(postId);
  postIdRef.current = postId;

  const loadFirstPage = useCallback(async () => {
    const activeRequest = request.current + 1;
    request.current = activeRequest;
    setStatus("loading");
    setComments([]);
    setNextCursor(null);
    setLoadingMore(false);
    setActionError("");
    try {
      const page = await store.listCommentPage({
        postId,
        limit: COMMENT_PAGE_SIZE,
      });
      if (request.current !== activeRequest) return;
      setComments(mergeComments([], page.items));
      setNextCursor(page.nextCursor);
      setStatus("ready");
    } catch {
      if (request.current === activeRequest) setStatus("error");
    }
  }, [postId, store]);

  useEffect(() => {
    void loadFirstPage();
    return () => {
      request.current += 1;
    };
  }, [loadFirstPage]);

  useEffect(() => {
    setEditingId(null);
    setEditDraft("");
    setEditError("");
  }, [viewerId]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const activeRequest = request.current;
    const activePostId = postId;
    setLoadingMore(true);
    setActionError("");
    try {
      const page = await store.listCommentPage({
        postId: activePostId,
        limit: COMMENT_PAGE_SIZE,
        before: nextCursor,
      });
      if (
        request.current !== activeRequest ||
        postIdRef.current !== activePostId
      ) {
        return;
      }
      setComments((current) => mergeComments(current, page.items));
      setNextCursor(page.nextCursor);
    } catch {
      if (
        request.current === activeRequest &&
        postIdRef.current === activePostId
      ) {
        setActionError("댓글을 더 불러오지 못했습니다. 다시 시도해 주세요.");
      }
    } finally {
      if (
        request.current === activeRequest &&
        postIdRef.current === activePostId
      ) {
        setLoadingMore(false);
      }
    }
  }

  async function createComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || status !== "ready") return;
    const body = normalizeCommunityText(draft, MAX_COMMUNITY_COMMENT_LENGTH);
    setActionError("");
    if (!body) {
      setFormError(
        draft.trim()
          ? `댓글은 ${MAX_COMMUNITY_COMMENT_LENGTH}자까지 입력할 수 있습니다.`
          : "댓글 내용을 입력해 주세요.",
      );
      return;
    }
    if (!viewerId) {
      setFormError(
        onLoginRequired?.() || COMMUNITY_FAILURE_COPY.auth,
      );
      return;
    }

    setPending("create");
    setFormError("");
    try {
      const created = await store.createComment(viewerId, postId, { body });
      setComments((current) => mergeComments(current, [created]));
      setDraft("");
      onCountChange(1);
    } catch {
      setFormError(COMMUNITY_FAILURE_COPY.comment);
    } finally {
      setPending("");
    }
  }

  function startEdit(comment: CommunityComment) {
    if (comment.author.id !== viewerId || pending) return;
    setEditingId(comment.id);
    setEditDraft(comment.body);
    setEditError("");
    setActionError("");
  }

  function cancelEdit() {
    if (pending.startsWith("edit:")) return;
    setEditingId(null);
    setEditDraft("");
    setEditError("");
  }

  async function updateComment(
    event: FormEvent<HTMLFormElement>,
    comment: CommunityComment,
  ) {
    event.preventDefault();
    if (!viewerId || comment.author.id !== viewerId || pending) return;
    const body = normalizeCommunityText(
      editDraft,
      MAX_COMMUNITY_COMMENT_LENGTH,
    );
    if (!body) {
      setEditError(
        editDraft.trim()
          ? `댓글은 ${MAX_COMMUNITY_COMMENT_LENGTH}자까지 입력할 수 있습니다.`
          : "댓글 내용을 입력해 주세요.",
      );
      return;
    }

    setPending(`edit:${comment.id}`);
    setEditError("");
    try {
      const updated = await store.updateComment(viewerId, comment.id, body);
      setComments((current) => mergeComments(current, [updated]));
      setEditingId(null);
      setEditDraft("");
    } catch {
      setEditError("댓글을 수정하지 못했습니다. 작성 내용은 그대로 두었습니다.");
    } finally {
      setPending("");
    }
  }

  async function deleteComment(comment: CommunityComment) {
    if (!viewerId || comment.author.id !== viewerId || pending) return;
    setPending(`delete:${comment.id}`);
    setActionError("");
    try {
      await store.deleteComment(viewerId, comment.id);
      setComments((current) =>
        current.filter((candidate) => candidate.id !== comment.id),
      );
      if (editingId === comment.id) cancelEdit();
      onCountChange(-1);
    } catch (error) {
      if (error instanceof CommunityStoreError && error.code === "not_found") {
        setComments((current) =>
          current.filter((candidate) => candidate.id !== comment.id),
        );
        if (editingId === comment.id) cancelEdit();
        onCountChange(-1);
        setActionError("이미 삭제된 댓글이라 목록에서 정리했습니다.");
      } else {
        setActionError(
          "댓글을 삭제하지 못했습니다. 댓글은 그대로 두었습니다. 다시 시도해 주세요.",
        );
      }
    } finally {
      setPending("");
    }
  }

  return (
    <section
      aria-labelledby="post-comments-title"
      className={styles.discussion}
    >
      <header className={styles.discussionHeader}>
        <div>
          <h2 id="post-comments-title">댓글</h2>
          <p>개인정보와 회사 기밀은 적지 말아 주세요.</p>
        </div>
        <strong>{comments.length}개 표시 · 전체 {totalCount}개</strong>
      </header>

      {status === "loading" && (
        <p className={styles.emptyComments} role="status">
          댓글 불러오는 중…
        </p>
      )}
      {status === "error" && (
        <div className={styles.commentLoadState} role="alert">
          <p>댓글을 불러오지 못했습니다.</p>
          <button onClick={() => void loadFirstPage()} type="button">
            다시 불러오기
          </button>
        </div>
      )}
      {status === "ready" && comments.length > 0 && (
        <ul aria-label="댓글 목록" className={styles.comments}>
          {comments.map((comment) => {
            const owner = comment.author.id === viewerId;
            const editing = editingId === comment.id;
            return (
              <li className={styles.comment} key={comment.id}>
                <span
                  aria-hidden="true"
                  className={styles.avatar}
                  data-tone="violet"
                >
                  {(comment.author.nickname?.trim() || "이").slice(0, 1)}
                </span>
                <div>
                  <header>
                    <strong>
                      {comment.author.nickname?.trim() || "이직핏 사용자"}
                    </strong>
                    <span>{formatDate(comment.createdAt)}</span>
                  </header>
                  {editing ? (
                    <form
                      aria-label={`${comment.body} 댓글 수정 양식`}
                      className={styles.commentEditForm}
                      onSubmit={(event) => void updateComment(event, comment)}
                    >
                      <label htmlFor={`comment-edit-${comment.id}`}>
                        댓글 수정 내용
                      </label>
                      <textarea
                        id={`comment-edit-${comment.id}`}
                        maxLength={MAX_COMMUNITY_COMMENT_LENGTH}
                        onChange={(event) => {
                          setEditDraft(event.target.value);
                          if (editError) setEditError("");
                        }}
                        rows={4}
                        value={editDraft}
                      />
                      <div>
                        <span>{editDraft.length}/{MAX_COMMUNITY_COMMENT_LENGTH}</span>
                        <button
                          disabled={pending === `edit:${comment.id}`}
                          onClick={cancelEdit}
                          type="button"
                        >
                          수정 취소
                        </button>
                        <button
                          disabled={pending === `edit:${comment.id}`}
                          type="submit"
                        >
                          {pending === `edit:${comment.id}`
                            ? "저장 중…"
                            : "수정 저장"}
                        </button>
                      </div>
                      {editError && <p role="alert">{editError}</p>}
                    </form>
                  ) : (
                    <>
                      <p>{comment.body}</p>
                      {owner && (
                        <div className={styles.commentActions}>
                          <button
                            aria-label={`${comment.body} 댓글 수정`}
                            className={styles.commentDelete}
                            disabled={Boolean(pending)}
                            onClick={() => startEdit(comment)}
                            type="button"
                          >
                            <PencilSimple aria-hidden="true" size={14} />
                            수정
                          </button>
                          <button
                            aria-label={`${comment.body} 댓글 삭제`}
                            className={styles.commentDelete}
                            disabled={Boolean(pending)}
                            onClick={() => void deleteComment(comment)}
                            type="button"
                          >
                            <Trash aria-hidden="true" size={14} />
                            삭제
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {status === "ready" && comments.length === 0 && (
        <p className={styles.emptyComments}>
          아직 댓글이 없습니다. 첫 댓글을 남겨 주세요.
        </p>
      )}

      {nextCursor && status === "ready" && (
        <button
          className={styles.commentLoadMore}
          disabled={loadingMore}
          onClick={() => void loadMore()}
          type="button"
        >
          <ArrowDown aria-hidden="true" size={16} weight="bold" />
          {loadingMore ? "댓글 불러오는 중…" : "댓글 더 보기"}
        </button>
      )}

      {actionError && <p className={styles.commentActionError} role="alert">{actionError}</p>}
      <form className={styles.form} id="post-comment-form" onSubmit={createComment}>
        <label htmlFor="post-comment-body">댓글 내용</label>
        <textarea
          aria-describedby={formError ? "post-comment-error" : "post-comment-storage-note"}
          id="post-comment-body"
          maxLength={MAX_COMMUNITY_COMMENT_LENGTH}
          onChange={(event) => {
            setDraft(event.target.value);
            if (formError) setFormError("");
          }}
          placeholder="생각이나 경험을 남겨 주세요."
          rows={4}
          value={draft}
        />
        <div className={styles.formFooter}>
          <div>
            <span>{draft.length}/{MAX_COMMUNITY_COMMENT_LENGTH}</span>
            <small id="post-comment-storage-note">
              {viewerId
                ? "댓글은 계정에 등록됩니다."
                : "댓글을 등록하려면 로그인해 주세요."}
            </small>
          </div>
          <button
            disabled={pending === "create" || status !== "ready"}
            type="submit"
          >
            <PaperPlaneTilt aria-hidden="true" size={18} weight="bold" />
            {pending === "create" ? "등록 중…" : "댓글 등록"}
          </button>
        </div>
        {formError && (
          <p id="post-comment-error" role="alert">
            {formError}
          </p>
        )}
      </form>
    </section>
  );
}
