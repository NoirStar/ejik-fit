"use client";

import { useEffect } from "react";

import {
  recordRecentCommunityTopic,
  type RecentCommunityTopicDraft,
} from "@/lib/recent-community-topics";

export function RecentTopicTracker({
  postId,
  source,
  title,
  topicLabel,
}: RecentCommunityTopicDraft) {
  useEffect(() => {
    recordRecentCommunityTopic({ postId, source, title, topicLabel });
  }, [postId, source, title, topicLabel]);

  return null;
}
