import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Briefcase,
  Buildings,
  Info,
  ListChecks,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import styles from "@/app/posts/[id]/post-detail.module.css";

import type { MockPostDetail } from "./mock-post-details";
import { RecentTopicTracker } from "./recent-topic-tracker";
import type {
  CommunityPostFeedItem,
  InterviewReviewFeedItem,
} from "./types";

type SocialPost = CommunityPostFeedItem | InterviewReviewFeedItem;

type PostDetailViewProps = {
  detail: MockPostDetail;
  post: SocialPost;
  relatedPosts: SocialPost[];
};

function InterviewContext({ post }: { post: InterviewReviewFeedItem }) {
  return (
    <section aria-label="면접 후기 정보" className={styles.interviewContext}>
      <div>
        <Buildings aria-hidden="true" size={18} weight="duotone" />
        <span>기업 유형</span>
        <strong>{post.companyType}</strong>
      </div>
      <div>
        <Briefcase aria-hidden="true" size={18} weight="duotone" />
        <span>직무</span>
        <strong>{post.role}</strong>
      </div>
      <div>
        <ListChecks aria-hidden="true" size={18} weight="duotone" />
        <span>전형</span>
        <strong>{post.stage}</strong>
      </div>
      <p>이직핏이 구성한 면접 이야기이며 특정 기업의 실제 면접 기록이 아닙니다.</p>
    </section>
  );
}

export function PostDetailView({
  detail,
  post,
  relatedPosts,
}: PostDetailViewProps) {
  return (
    <main className={styles.main}>
      <RecentTopicTracker
        postId={post.id}
        source={post.source}
        title={post.title}
        topicLabel={post.tags[0] ?? post.category}
      />
      <Link className={styles.backLink} href="/">
        <ArrowLeft aria-hidden="true" size={16} weight="bold" />
        홈 피드로 돌아가기
      </Link>

      <div className={styles.workspace}>
        <article className={styles.article}>
          <header className={styles.hero}>
            <div className={styles.contextRow}>
              <span className={styles.category}>{post.category}</span>
              <span className={styles.mockBadge}>이직핏 커뮤니티 가이드</span>
            </div>

            <h1>{post.title}</h1>

            <div className={styles.author}>
              <span
                aria-hidden="true"
                className={styles.authorAvatar}
                data-tone="violet"
              >
                이
              </span>
              <div>
                <strong>이직핏 편집팀</strong>
                <span>커뮤니티 활용 예시</span>
              </div>
              <div className={styles.authorMeta}>
                <span>읽기 전용</span>
              </div>
            </div>
          </header>

          {post.type === "interview_review" && (
            <InterviewContext post={post} />
          )}

          <section aria-label="글 본문" className={styles.body}>
            {detail.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>

          <ul aria-label="글 태그" className={styles.tags}>
            {post.tags.map((tag) => (
              <li key={tag}>#{tag}</li>
            ))}
          </ul>
        </article>

        <aside aria-label="이 글 안내" className={styles.sidebar}>
          <section className={styles.dataNotice}>
            <Info aria-hidden="true" size={21} weight="fill" />
            <div>
              <p>가이드 안내</p>
              <h2>읽기 전용 커뮤니티 예시</h2>
              <p>
                실제 회원이 작성한 게시물이 아닌 읽기 전용 예시입니다. 어떤 질문과
                경험을 나눌 수 있는지 이직핏이 구성했습니다.
              </p>
              <p>
                공감·댓글·저장·팔로우 수와 실제 커뮤니티 활동에는 포함되지 않습니다.
              </p>
            </div>
          </section>

          <nav aria-label="관련 글" className={styles.related}>
            <header>
              <BookOpenText aria-hidden="true" size={19} weight="duotone" />
              <h2>함께 읽을 가이드</h2>
            </header>
            <ul>
              {relatedPosts.map((related) => (
                <li key={related.id}>
                  <Link
                    aria-label={`${related.title} 읽기`}
                    href={related.href}
                  >
                    <span>{related.category}</span>
                    <strong>{related.title}</strong>
                    <ArrowRight aria-hidden="true" size={16} weight="bold" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </main>
  );
}
