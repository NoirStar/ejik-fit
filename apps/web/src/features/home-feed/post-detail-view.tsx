import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Buildings,
  ChatCenteredText,
  Info,
  ListChecks,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import styles from "@/app/posts/[id]/post-detail.module.css";

import type { MockPostDetail } from "./mock-post-details";
import { AuthorFollowButton } from "./author-follow-button";
import { PostDetailActions } from "./post-detail-actions";
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

function AuthorAvatar({ post }: { post: SocialPost }) {
  return (
    <span
      aria-hidden="true"
      className={styles.authorAvatar}
      data-tone={post.authorTone}
    >
      {post.authorName.slice(0, 1)}
    </span>
  );
}

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
      <p>화면 검증을 위한 예시이며 특정 기업의 실제 면접 기록이 아닙니다.</p>
    </section>
  );
}

export function PostDetailView({
  detail,
  post,
  relatedPosts,
}: PostDetailViewProps) {
  const lead = post.type === "community_post" ? post.body : post.summary;

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
              <span className={styles.mockBadge}>커뮤니티 예시 콘텐츠</span>
            </div>

            <h1>{post.title}</h1>
            <p className={styles.lead}>{lead}</p>

            <div className={styles.author}>
              <AuthorAvatar post={post} />
              <div>
                <strong>{post.authorName}</strong>
                <span>{post.authorHeadline}</span>
              </div>
              <div className={styles.authorMeta}>
                <time dateTime={post.createdAt}>{post.createdLabel}</time>
                <AuthorFollowButton
                  authorId={post.authorId}
                  authorName={post.authorName}
                />
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

          <PostDetailActions
            metrics={post.metrics}
            postId={post.id}
            postTitle={post.title}
            sampleComments={detail.sampleComments}
          />
        </article>

        <aside aria-label="이 글 안내" className={styles.sidebar}>
          <section className={styles.dataNotice}>
            <Info aria-hidden="true" size={21} weight="fill" />
            <div>
              <p>데이터 안내</p>
              <h2>커뮤니티 화면용 예시</h2>
              <p>
                글, 작성자, 댓글, 반응 수는 모두 정식 커뮤니티 연동 전에 화면을
                살펴볼 수 있도록 만든 예시 콘텐츠입니다.
              </p>
              <p>
                이 페이지에는 실제 채용공고나 스킬 시장 수치를 섞어 표시하지
                않습니다.
              </p>
            </div>
          </section>

          <nav aria-label="관련 글" className={styles.related}>
            <header>
              <ChatCenteredText aria-hidden="true" size={19} weight="duotone" />
              <h2>함께 읽을 예시 글</h2>
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
