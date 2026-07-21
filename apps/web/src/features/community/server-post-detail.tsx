"use client";

import {
  ArrowLeft,
  BookmarkSimple,
  ChatCircle,
  CheckCircle,
  Flag,
  Heart,
  Info,
  PaperPlaneTilt,
  Trash,
  UserCheck,
  UserPlus,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import detailStyles from "@/app/posts/[id]/post-detail.module.css";
import { useAuthViewerContext } from "@/features/auth/auth-viewer-context";
import { RecentTopicTracker } from "@/features/home-feed/recent-topic-tracker";
import { serverCommunityPostToFeedItem } from "@/features/home-feed/model";
import { buildSearchScopeHref } from "@/features/search/model";
import {
  MAX_COMMUNITY_COMMENT_LENGTH,
  type CommunityComment,
  type CommunityPost,
  type CommunityReportReason,
  type CommunityViewerState,
} from "@/lib/community-contract";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

import actionStyles from "@/features/home-feed/post-detail-actions.module.css";
import {
  createSupabaseCommunityStore,
  type CommunityStore,
} from "./community-store";

const EMPTY_VIEWER_STATE: CommunityViewerState = {
  reactedPostIds: [],
  savedPostIds: [],
  followedAuthorIds: [],
};

const REPORT_REASONS: Array<{
  value: CommunityReportReason;
  label: string;
}> = [
  { value: "spam", label: "스팸 또는 홍보" },
  { value: "harassment", label: "괴롭힘 또는 혐오 표현" },
  { value: "privacy", label: "개인정보 노출" },
  { value: "misinformation", label: "오해를 부르는 정보" },
  { value: "other", label: "기타" },
];

type ServerPostDetailProps = {
  postId: string;
  store?: CommunityStore;
};

type DetailStatus = "loading" | "ready" | "missing" | "error" | "removed";

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

function DetailState({
  onRetry,
  status,
}: {
  onRetry(): void;
  status: Exclude<DetailStatus, "ready">;
}) {
  const copy =
    status === "loading"
      ? {
          eyebrow: "커뮤니티",
          title: "글을 불러오고 있습니다.",
          body: "계정에 저장된 글과 댓글을 확인하고 있어요.",
        }
      : status === "removed"
        ? {
            eyebrow: "삭제 완료",
            title: "글을 삭제했습니다.",
            body: "홈 피드와 내 글 목록에서도 더 이상 표시되지 않습니다.",
          }
        : status === "missing"
          ? {
              eyebrow: "커뮤니티",
              title: "글을 찾을 수 없습니다.",
              body: "삭제되었거나 공개 범위에서 확인할 수 없는 글입니다.",
            }
          : {
              eyebrow: "연결 오류",
              title: "커뮤니티 글을 불러오지 못했습니다.",
              body: "잠시 후 다시 시도해주세요.",
            };

  return (
    <main className={detailStyles.main}>
      <Link className={detailStyles.backLink} href="/">
        <ArrowLeft aria-hidden="true" size={16} weight="bold" />
        홈 피드로 돌아가기
      </Link>
      <section className={detailStyles.localState} role="status">
        <p>{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <span>{copy.body}</span>
        {status === "error" && (
          <button onClick={onRetry} type="button">
            다시 불러오기
          </button>
        )}
      </section>
    </main>
  );
}

export function ServerPostDetail({ postId, store: injectedStore }: ServerPostDetailProps) {
  const { ready: authReady, viewer } = useAuthViewerContext();
  const [status, setStatus] = useState<DetailStatus>("loading");
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [viewerState, setViewerState] =
    useState<CommunityViewerState>(EMPTY_VIEWER_STATE);
  const [pending, setPending] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] =
    useState<CommunityReportReason>("other");
  const [reportDetails, setReportDetails] = useState("");
  const request = useRef(0);
  const productionStore = useRef<CommunityStore | null | undefined>(undefined);

  const resolveStore = useCallback(() => {
    if (injectedStore) return injectedStore;
    if (productionStore.current !== undefined) return productionStore.current;
    const client = createBrowserSupabaseClient();
    productionStore.current = client
      ? createSupabaseCommunityStore(client)
      : null;
    return productionStore.current;
  }, [injectedStore]);

  const load = useCallback(async () => {
    const currentRequest = request.current + 1;
    request.current = currentRequest;
    if (!authReady) {
      setStatus("loading");
      return;
    }
    const store = resolveStore();
    if (!store) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    try {
      const [loadedPost, loadedComments] = await Promise.all([
        store.getPost(postId),
        store.listComments(postId),
      ]);
      if (request.current !== currentRequest) return;
      if (!loadedPost) {
        setStatus("missing");
        return;
      }
      const loadedViewerState = viewer
        ? await store.loadViewerState(viewer.id, {
            postIds: [loadedPost.id],
            authorIds: [loadedPost.author.id],
          })
        : EMPTY_VIEWER_STATE;
      if (request.current !== currentRequest) return;
      setPost(loadedPost);
      setComments(loadedComments);
      setViewerState(loadedViewerState);
      setStatus("ready");
    } catch {
      if (request.current === currentRequest) setStatus("error");
    }
  }, [authReady, postId, resolveStore, viewer]);

  useEffect(() => {
    void load();
    return () => {
      request.current += 1;
    };
  }, [load]);

  const item = useMemo(
    () => (post ? serverCommunityPostToFeedItem(post) : null),
    [post],
  );

  function requireViewer() {
    if (viewer) return true;
    setAnnouncement("로그인하면 커뮤니티 활동을 계정에 저장할 수 있습니다.");
    return false;
  }

  async function toggleReaction() {
    if (!post || !requireViewer() || pending) return;
    const store = resolveStore();
    if (!store || !viewer) return;
    const active = viewerState.reactedPostIds.includes(post.id);
    setPending("reaction");
    setError("");
    try {
      await store.setPostReaction(viewer.id, post.id, !active);
      setViewerState((current) => ({
        ...current,
        reactedPostIds: active ? [] : [post.id],
      }));
      setPost((current) =>
        current
          ? {
              ...current,
              metrics: {
                ...current.metrics,
                reactions: Math.max(0, current.metrics.reactions + (active ? -1 : 1)),
              },
            }
          : current,
      );
    } catch {
      setError("공감을 반영하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setPending("");
    }
  }

  async function toggleSaved() {
    if (!post || !requireViewer() || pending) return;
    const store = resolveStore();
    if (!store || !viewer) return;
    const active = viewerState.savedPostIds.includes(post.id);
    setPending("save");
    setError("");
    try {
      await store.setPostSaved(viewer.id, post.id, !active);
      setViewerState((current) => ({
        ...current,
        savedPostIds: active ? [] : [post.id],
      }));
      setPost((current) =>
        current
          ? {
              ...current,
              metrics: {
                ...current.metrics,
                saves: Math.max(0, current.metrics.saves + (active ? -1 : 1)),
              },
            }
          : current,
      );
    } catch {
      setError("저장 상태를 반영하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setPending("");
    }
  }

  async function toggleFollowed() {
    if (!post || !requireViewer() || !viewer || pending) return;
    if (post.author.id === viewer.id) return;
    const store = resolveStore();
    if (!store) return;
    const active = viewerState.followedAuthorIds.includes(post.author.id);
    setPending("follow");
    setError("");
    try {
      await store.setAuthorFollowed(viewer.id, post.author.id, !active);
      setViewerState((current) => ({
        ...current,
        followedAuthorIds: active ? [] : [post.author.id],
      }));
      setAnnouncement(
        `${item?.authorName ?? "작성자"} ${active ? "팔로우를 해제했습니다." : "팔로우를 시작했습니다."}`,
      );
    } catch {
      setError("팔로우 상태를 반영하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setPending("");
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    setAnnouncement("");
    if (!body) {
      setError("댓글 내용을 입력해 주세요.");
      return;
    }
    if (body.length > MAX_COMMUNITY_COMMENT_LENGTH) {
      setError(`댓글은 ${MAX_COMMUNITY_COMMENT_LENGTH}자까지 입력할 수 있습니다.`);
      return;
    }
    if (!post || !requireViewer() || !viewer || pending) return;
    const store = resolveStore();
    if (!store) return;
    setPending("comment");
    setError("");
    try {
      const comment = await store.createComment(viewer.id, post.id, { body });
      setComments((current) => [...current, comment]);
      setPost((current) =>
        current
          ? {
              ...current,
              metrics: {
                ...current.metrics,
                comments: current.metrics.comments + 1,
              },
            }
          : current,
      );
      setDraft("");
      setAnnouncement("댓글을 계정에 등록했습니다.");
    } catch {
      setError("댓글을 등록하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setPending("");
    }
  }

  async function deleteComment(comment: CommunityComment) {
    if (!viewer || pending || comment.author.id !== viewer.id) return;
    const store = resolveStore();
    if (!store) return;
    setPending(`comment:${comment.id}`);
    setError("");
    try {
      await store.deleteComment(viewer.id, comment.id);
      setComments((current) => current.filter((item) => item.id !== comment.id));
      setPost((current) =>
        current
          ? {
              ...current,
              metrics: {
                ...current.metrics,
                comments: Math.max(0, current.metrics.comments - 1),
              },
            }
          : current,
      );
      setAnnouncement("댓글을 삭제했습니다.");
    } catch {
      setError("댓글을 삭제하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setPending("");
    }
  }

  async function deletePost() {
    if (!post || !viewer || post.author.id !== viewer.id || pending) return;
    const store = resolveStore();
    if (!store) return;
    setPending("delete");
    setError("");
    try {
      await store.deletePost(viewer.id, post.id);
      setStatus("removed");
    } catch {
      setError("글을 삭제하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setPending("");
    }
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!post || !requireViewer() || !viewer || pending) return;
    const store = resolveStore();
    if (!store) return;
    setPending("report");
    setError("");
    try {
      await store.createReport(viewer.id, {
        targetType: "post",
        targetId: post.id,
        reason: reportReason,
        ...(reportDetails.trim() ? { details: reportDetails.trim() } : {}),
      });
      setReportOpen(false);
      setReportDetails("");
      setAnnouncement("신고를 접수했습니다. 검토 후 필요한 조치를 진행합니다.");
    } catch {
      setError("신고를 접수하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setPending("");
    }
  }

  if (status !== "ready" || !post || !item) {
    return <DetailState onRetry={() => void load()} status={status === "ready" ? "error" : status} />;
  }

  const reacted = viewerState.reactedPostIds.includes(post.id);
  const saved = viewerState.savedPostIds.includes(post.id);
  const followed = viewerState.followedAuthorIds.includes(post.author.id);
  const owner = viewer?.id === post.author.id;
  const paragraphs = post.body.split(/\n+/).filter((paragraph) => paragraph.trim());

  return (
    <main className={detailStyles.main}>
      <RecentTopicTracker
        postId={post.id}
        source="server"
        title={post.title}
        topicLabel={post.tags[0] ?? post.category}
      />
      <Link className={detailStyles.backLink} href="/">
        <ArrowLeft aria-hidden="true" size={16} weight="bold" />
        홈 피드로 돌아가기
      </Link>

      <div className={detailStyles.workspace}>
        <article className={detailStyles.article}>
          <header className={detailStyles.hero}>
            <div className={detailStyles.contextRow}>
              <span className={detailStyles.category}>{post.category}</span>
              <span className={detailStyles.localBadge}>공개 커뮤니티</span>
            </div>
            <h1>{post.title}</h1>
            <div className={detailStyles.author}>
              <span
                aria-hidden="true"
                className={detailStyles.authorAvatar}
                data-tone={item.authorTone}
              >
                {item.authorName.slice(0, 1)}
              </span>
              <div>
                <strong>{item.authorName}</strong>
                <span>{item.authorHeadline}</span>
              </div>
              <div className={detailStyles.authorMeta}>
                <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
                {!owner && (
                  <button
                    aria-label={`${item.authorName} ${followed ? "팔로우 해제" : "팔로우"}`}
                    aria-pressed={followed}
                    className={detailStyles.serverAuthorAction}
                    data-active={followed ? "true" : undefined}
                    disabled={Boolean(pending)}
                    onClick={() => void toggleFollowed()}
                    type="button"
                  >
                    {followed ? (
                      <UserCheck aria-hidden="true" size={16} weight="fill" />
                    ) : (
                      <UserPlus aria-hidden="true" size={16} weight="bold" />
                    )}
                    {followed ? "팔로잉" : "팔로우"}
                  </button>
                )}
              </div>
            </div>
          </header>

          <section aria-label="글 본문" className={detailStyles.body}>
            {paragraphs.map((paragraph, index) => (
              <p key={`${index}-${paragraph}`}>{paragraph}</p>
            ))}
          </section>

          {post.tags.length > 0 && (
            <ul aria-label="글 태그" className={detailStyles.tags}>
              {post.tags.map((tag) => (
                <li key={tag}>
                  <Link href={buildSearchScopeHref(tag, "community")}>#{tag}</Link>
                </li>
              ))}
            </ul>
          )}

          <section aria-label="글 반응과 댓글" className={actionStyles.root}>
            <div className={actionStyles.actionBar}>
              <button
                aria-label={`${post.title} ${reacted ? "공감 취소" : "공감"}`}
                aria-pressed={reacted}
                data-active={reacted ? "true" : undefined}
                disabled={Boolean(pending)}
                onClick={() => void toggleReaction()}
                type="button"
              >
                <Heart aria-hidden="true" size={20} weight={reacted ? "fill" : "regular"} />
                <span>공감 {post.metrics.reactions}</span>
              </button>
              <a href="#post-comment-form">
                <ChatCircle aria-hidden="true" size={20} />
                <span>댓글 {post.metrics.comments}</span>
              </a>
              <button
                aria-label={`${post.title} ${saved ? "저장 해제" : "저장"}`}
                aria-pressed={saved}
                data-active={saved ? "true" : undefined}
                disabled={Boolean(pending)}
                onClick={() => void toggleSaved()}
                type="button"
              >
                <BookmarkSimple aria-hidden="true" size={20} weight={saved ? "fill" : "regular"} />
                <span>저장 {post.metrics.saves}</span>
              </button>
            </div>
            <p className={actionStyles.metricNote}>
              반응과 댓글은 로그인 계정에 저장되며 모든 사용자에게 같은 수치로 표시됩니다.
            </p>

            <section aria-labelledby="post-comments-title" className={actionStyles.discussion}>
              <header className={actionStyles.discussionHeader}>
                <div>
                  <h2 id="post-comments-title">댓글</h2>
                  <p>경험과 의견을 나누되 개인정보와 회사 기밀은 포함하지 마세요.</p>
                </div>
                <strong>{comments.length}개 표시</strong>
              </header>

              {comments.length > 0 ? (
                <ul aria-label="댓글 목록" className={actionStyles.comments}>
                  {comments.map((comment) => (
                    <li className={actionStyles.comment} key={comment.id}>
                      <span aria-hidden="true" className={actionStyles.avatar} data-tone="violet">
                        {(comment.author.nickname?.trim() || "이").slice(0, 1)}
                      </span>
                      <div>
                        <header>
                          <strong>{comment.author.nickname?.trim() || "이직핏 사용자"}</strong>
                          <span>{formatDate(comment.createdAt)}</span>
                        </header>
                        <p>{comment.body}</p>
                        {comment.author.id === viewer?.id && (
                          <button
                            aria-label={`${comment.body} 댓글 삭제`}
                            className={actionStyles.commentDelete}
                            disabled={Boolean(pending)}
                            onClick={() => void deleteComment(comment)}
                            type="button"
                          >
                            <Trash aria-hidden="true" size={14} />
                            삭제
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={actionStyles.emptyComments}>아직 댓글이 없습니다. 첫 의견을 남겨보세요.</p>
              )}

              <form className={actionStyles.form} id="post-comment-form" onSubmit={submitComment}>
                <label htmlFor="post-comment-body">댓글 내용</label>
                <textarea
                  aria-describedby={error ? "post-comment-error" : "post-comment-storage-note"}
                  id="post-comment-body"
                  maxLength={MAX_COMMUNITY_COMMENT_LENGTH}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    if (error) setError("");
                  }}
                  placeholder="이 글에 대한 생각이나 경험을 남겨보세요."
                  rows={4}
                  value={draft}
                />
                <div className={actionStyles.formFooter}>
                  <div>
                    <span>{draft.length}/{MAX_COMMUNITY_COMMENT_LENGTH}</span>
                    <small id="post-comment-storage-note">
                      {viewer ? "댓글은 내 계정으로 등록됩니다." : "댓글을 등록하려면 로그인이 필요합니다."}
                    </small>
                  </div>
                  <button disabled={pending === "comment"} type="submit">
                    <PaperPlaneTilt aria-hidden="true" size={18} weight="bold" />
                    {pending === "comment" ? "등록 중..." : "댓글 등록"}
                  </button>
                </div>
                {error && (
                  <p id="post-comment-error" role="alert">
                    {error}
                  </p>
                )}
                {announcement && (
                  <p role="status">
                    <CheckCircle aria-hidden="true" size={15} weight="fill" /> {announcement}
                  </p>
                )}
              </form>
            </section>
          </section>
        </article>

        <aside aria-label="이 글 안내" className={detailStyles.sidebar}>
          <section className={detailStyles.dataNotice}>
            <Info aria-hidden="true" size={21} weight="fill" />
            <div>
              <p>커뮤니티 안내</p>
              <h2>계정에 저장된 공개 글</h2>
              <p>이 글과 댓글, 반응은 이직핏 커뮤니티 서버에 저장됩니다.</p>
              <p>신고된 콘텐츠는 운영 정책에 따라 검토합니다.</p>
            </div>
          </section>

          {owner ? (
            <section className={detailStyles.localManagement}>
              <h2>내 글 관리</h2>
              <p>삭제하면 글에 연결된 댓글과 반응도 함께 삭제되며 되돌릴 수 없습니다.</p>
              {!deleteConfirm ? (
                <button onClick={() => setDeleteConfirm(true)} type="button">
                  <Trash aria-hidden="true" size={17} />
                  이 글 삭제
                </button>
              ) : (
                <div className={detailStyles.deleteActions}>
                  <button onClick={() => setDeleteConfirm(false)} type="button">취소</button>
                  <button disabled={pending === "delete"} onClick={() => void deletePost()} type="button">
                    {pending === "delete" ? "삭제 중..." : "정말 삭제"}
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section className={detailStyles.reportPanel}>
              <button
                onClick={() => {
                  if (requireViewer()) setReportOpen((current) => !current);
                }}
                type="button"
              >
                <Flag aria-hidden="true" size={16} />
                이 글 신고
              </button>
              {reportOpen && (
                <form onSubmit={submitReport}>
                  <label htmlFor="community-report-reason">신고 사유</label>
                  <select
                    id="community-report-reason"
                    onChange={(event) => setReportReason(event.target.value as CommunityReportReason)}
                    value={reportReason}
                  >
                    {REPORT_REASONS.map((reason) => (
                      <option key={reason.value} value={reason.value}>{reason.label}</option>
                    ))}
                  </select>
                  <label htmlFor="community-report-details">설명 (선택)</label>
                  <textarea
                    id="community-report-details"
                    maxLength={500}
                    onChange={(event) => setReportDetails(event.target.value)}
                    rows={3}
                    value={reportDetails}
                  />
                  <button disabled={pending === "report"} type="submit">
                    {pending === "report" ? "접수 중..." : "신고 접수"}
                  </button>
                </form>
              )}
            </section>
          )}

          {error && (
            <section className={detailStyles.dataNotice} role="alert">
              <WarningCircle aria-hidden="true" size={20} weight="fill" />
              <div>
                <p>작업 오류</p>
                <h2>{error}</h2>
              </div>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
