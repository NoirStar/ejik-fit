"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  readRecentCommunityTopics,
  subscribeRecentCommunityTopics,
  type RecentCommunityTopic,
} from "@/lib/recent-community-topics";

import styles from "./home-feed.module.css";

const VISIBLE_RECENT_TOPICS = 4;

export function RecentTopicList() {
  const [topics, setTopics] = useState<RecentCommunityTopic[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeRecentCommunityTopics(setTopics);
    setTopics(readRecentCommunityTopics());
    return unsubscribe;
  }, []);

  if (topics.length === 0) return null;

  return (
    <section
      aria-labelledby="recent-community-topics-title"
      className={styles.railCard}
    >
      <div className={styles.railHeadingRow}>
        <h2 id="recent-community-topics-title">최근 본 주제</h2>
        <span>이 브라우저</span>
      </div>
      <ul className={styles.recentTopics}>
        {topics.slice(0, VISIBLE_RECENT_TOPICS).map((topic) => (
          <li key={topic.postId}>
            <Link
              aria-label={`${topic.topicLabel}: ${topic.title} 다시 보기`}
              href={`/posts/${encodeURIComponent(topic.postId)}`}
            >
              <span># {topic.topicLabel}</span>
              <small>{topic.title}</small>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
