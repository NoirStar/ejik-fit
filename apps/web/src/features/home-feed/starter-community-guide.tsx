import { ArrowRight, BookOpenText } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import styles from "./home-feed.module.css";
import type {
  CommunityPostFeedItem,
  InterviewReviewFeedItem,
} from "./types";

type StarterGuideItem = CommunityPostFeedItem | InterviewReviewFeedItem;

export function StarterCommunityGuide({ items }: { items: StarterGuideItem[] }) {
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="starter-community-guide-title"
      className={styles.starterGuide}
    >
      <header className={styles.starterGuideHeader}>
        <div>
          <h2 id="starter-community-guide-title">이직핏 커뮤니티 가이드</h2>
          <p>
            어떤 질문과 경험을 나눌 수 있는지 보여주는 읽기 전용 예시입니다.
            실제 회원 활동과 반응 수에는 포함되지 않습니다.
          </p>
        </div>
        <BookOpenText aria-hidden="true" size={22} weight="duotone" />
      </header>

      <div className={styles.starterGuideList}>
        {items.slice(0, 3).map((item) => {
          const summary =
            item.type === "community_post" ? item.body : item.summary;
          return (
            <article aria-labelledby={`starter-${item.id}-title`} key={item.id}>
              <div className={styles.starterGuideLabel}>
                <span>이직핏 커뮤니티 가이드</span>
                <small>읽기 전용</small>
              </div>
              <h3 id={`starter-${item.id}-title`}>
                <Link
                  aria-label={`${item.title} 예시 읽기`}
                  href={item.href}
                  prefetch={false}
                >
                  {item.title}
                  <ArrowRight aria-hidden="true" size={16} weight="bold" />
                </Link>
              </h3>
              <p>{summary}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
