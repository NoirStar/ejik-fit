"use client";

import { ArrowLeft, Info, Trash } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import styles from "@/app/posts/[id]/post-detail.module.css";
import {
  deleteLocalCommunityPost,
  readLocalCommunityPosts,
  subscribeLocalCommunityPosts,
  type LocalCommunityPost,
} from "@/lib/local-community-posts";
import { removeRecentCommunityTopic } from "@/lib/recent-community-topics";

import { localCommunityPostToFeedItem } from "./model";
import { RecentTopicTracker } from "./recent-topic-tracker";

type LocalPostDetailState =
  | { status: "checking" }
  | { status: "ready"; post: LocalCommunityPost }
  | { status: "missing" }
  | { status: "removed" };

function LocalPostState({ status }: { status: "checking" | "missing" | "removed" }) {
  const copy =
    status === "checking"
      ? {
          title: "이 브라우저의 글을 확인하고 있습니다.",
          body: "서버가 아니라 현재 브라우저 저장소만 확인합니다.",
        }
      : status === "removed"
        ? {
            title: "글을 삭제했습니다.",
            body: "글과 이 글에 남긴 로컬 반응·댓글을 이 브라우저에서 지웠습니다.",
          }
        : {
            title: "이 브라우저에서 글을 찾지 못했습니다.",
            body: "다른 브라우저에서 작성했거나 이미 삭제한 글일 수 있습니다.",
          };

  return (
    <main className={styles.main}>
      <Link className={styles.backLink} href="/">
        <ArrowLeft aria-hidden="true" size={16} weight="bold" />
        홈 피드로 돌아가기
      </Link>
      <section className={styles.localState} role="status">
        <p>브라우저 전용 커뮤니티 글</p>
        <h1>{copy.title}</h1>
        <span>{copy.body}</span>
      </section>
    </main>
  );
}

export function LocalPostDetail({ postId }: { postId: string }) {
  const [state, setState] = useState<LocalPostDetailState>({ status: "checking" });
  const [error, setError] = useState("");

  useEffect(() => {
    const update = (posts: LocalCommunityPost[]) => {
      setState((current) => {
        if (current.status === "removed") return current;
        const post = posts.find((item) => item.id === postId);
        return post ? { status: "ready", post } : { status: "missing" };
      });
    };
    update(readLocalCommunityPosts());
    return subscribeLocalCommunityPosts(update);
  }, [postId]);

  if (state.status !== "ready") {
    return <LocalPostState status={state.status} />;
  }

  const item = localCommunityPostToFeedItem(state.post);

  function deletePost() {
    setError("");
    const result = deleteLocalCommunityPost(postId);
    if (result.status !== "removed") {
      setError(
        result.status === "interactions_failed"
          ? "글의 로컬 반응을 정리하지 못해 삭제를 중단했습니다."
          : "글을 브라우저에서 삭제하지 못했습니다.",
      );
      return;
    }
    removeRecentCommunityTopic(postId);
    setState({ status: "removed" });
  }

  return (
    <main className={styles.main}>
      <RecentTopicTracker
        postId={item.id}
        source={item.source}
        title={item.title}
        topicLabel={item.tags[0] ?? item.category}
      />
      <Link className={styles.backLink} href="/">
        <ArrowLeft aria-hidden="true" size={16} weight="bold" />
        홈 피드로 돌아가기
      </Link>

      <div className={styles.workspace}>
        <article className={styles.article}>
          <header className={styles.hero}>
            <div className={styles.contextRow}>
              <span className={styles.category}>{item.category}</span>
              <span className={styles.localBadge}>이전 기기 저장 글</span>
            </div>

            <h1>{item.title}</h1>

            <div className={styles.author}>
              <span
                aria-hidden="true"
                className={styles.authorAvatar}
                data-tone="violet"
              >
                나
              </span>
              <div>
                <strong>나</strong>
                <span>이 브라우저에서 작성</span>
              </div>
              <div className={styles.authorMeta}>
                <time dateTime={item.createdAt}>{item.createdLabel}</time>
              </div>
            </div>
          </header>

          <section aria-label="글 본문" className={styles.body}>
            <p>{item.body}</p>
          </section>

          {item.tags.length > 0 && (
            <ul aria-label="글 태그" className={styles.tags}>
              {item.tags.map((tag) => (
                <li key={tag}>#{tag}</li>
              ))}
            </ul>
          )}
        </article>

        <aside aria-label="이 글 안내" className={styles.sidebar}>
          <section className={styles.dataNotice}>
            <Info aria-hidden="true" size={21} weight="fill" />
            <div>
              <p>저장 안내</p>
              <h2>이 브라우저에 저장된 내 글</h2>
              <p>
                이 글은 서버 커뮤니티에 게시되지 않으며 다른 브라우저나 기기로
                동기화되지 않습니다.
              </p>
              <p>
                로그인하면 계정 이전을 시도하며, 성공하기 전까지 원문을 이
                브라우저에 보존합니다.
              </p>
            </div>
          </section>

          <section className={styles.localManagement}>
            <h2>내 글 관리</h2>
            <p>삭제하면 글과 이 글에 남긴 로컬 반응·댓글도 함께 지워집니다.</p>
            <button aria-label={`${item.title} 삭제`} onClick={deletePost} type="button">
              <Trash aria-hidden="true" size={17} />
              이 글 삭제
            </button>
            {error && <p role="alert">{error}</p>}
          </section>
        </aside>
      </div>
    </main>
  );
}
