"use client";

import { useState } from "react";

import {
  COMMUNITY_DRAFT_STORAGE_KEY,
  LEGACY_COMMUNITY_DRAFT_STORAGE_KEY,
  removeCommunityDraft,
} from "@/features/community/community-draft";
import { clearActivityNotificationCheckpoint } from "@/features/notifications/activity-notification-center";
import { clearCareerProfile } from "@/lib/career-profile";
import { clearCareerPreferences } from "@/lib/career-preferences";
import { clearFollowedCompanies } from "@/lib/followed-companies";
import { clearJobApplicationStages } from "@/lib/job-application-stages";
import { clearLocalCommunityPosts } from "@/lib/local-community-posts";
import { clearOwnedSkills } from "@/lib/owned-skills";
import { clearRecentCommunityTopics } from "@/lib/recent-community-topics";
import { clearSavedJobs } from "@/lib/saved-jobs";
import { clearSavedJobGroups } from "@/lib/saved-job-groups";
import { clearSocialInteractions } from "@/lib/social-interactions";

import styles from "../trust-pages.module.css";

export function ClearLocalData() {
  const [result, setResult] = useState<"success" | "failure" | null>(null);

  function clearData() {
    let storageCleared = false;
    let draftCleared = false;
    try {
      const storage = window.localStorage;
      clearOwnedSkills(storage);
      clearCareerProfile(storage);
      clearCareerPreferences(storage);
      clearLocalCommunityPosts(storage);
      clearRecentCommunityTopics(storage);
      clearSavedJobs(storage);
      clearSavedJobGroups(storage);
      clearJobApplicationStages(storage);
      clearSocialInteractions(storage);
      clearFollowedCompanies(storage);
      clearActivityNotificationCheckpoint(storage);
      const managedKeys = [
        "owned-skills",
        "career-profile",
        "career-preferences",
        "local-community-posts",
        "recent-community-topics",
        "saved-job-ids",
        "saved-job-groups",
        "job-application-stages",
        "social-interactions",
        "followed-company-slugs",
        "company-job-notifications-checked-at",
      ].flatMap((suffix) => [
        `careerfit:${suffix}`,
        `ejik-fit:${suffix}`,
      ]);
      storageCleared = managedKeys.every((key) => storage.getItem(key) === null);
    } catch {
      storageCleared = false;
    }
    try {
      const session = window.sessionStorage;
      removeCommunityDraft(session);
      draftCleared =
        session.getItem(COMMUNITY_DRAFT_STORAGE_KEY) === null &&
        session.getItem(LEGACY_COMMUNITY_DRAFT_STORAGE_KEY) === null;
    } catch {
      draftCleared = false;
    }
    window.history.replaceState({}, "", window.location.pathname);
    setResult(storageCleared && draftCleared ? "success" : "failure");
  }

  return (
    <div>
      <button className={styles.clearButton} onClick={clearData} type="button">
        이 브라우저의 저장 데이터 삭제
      </button>
      {result === "success" && (
        <p className={styles.status} role="status">
          저장 데이터를 삭제했습니다.
        </p>
      )}
      {result === "failure" && (
        <p className={styles.status} role="alert">
          일부 저장 데이터를 삭제하지 못했습니다. 브라우저 저장소 설정을 확인해
          주세요.
        </p>
      )}
    </div>
  );
}
