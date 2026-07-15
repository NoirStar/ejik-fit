"use client";

import { useEffect, useState } from "react";

import {
  accountCareerStateFromRow,
  accountCareerStateToLegacyRow,
  accountCareerStateToRow,
  mergeAccountCareerState,
  readBrowserAccountState,
  writeBrowserAccountState,
  type AccountCareerState,
  type AccountCareerStateRow,
} from "@/lib/account-state";
import { subscribeCareerPreferences } from "@/lib/career-preferences";
import { subscribeFollowedCompanies } from "@/lib/followed-companies";
import { subscribeJobApplicationStages } from "@/lib/job-application-stages";
import { subscribeOwnedSkills } from "@/lib/owned-skills";
import { subscribeSavedJobs } from "@/lib/saved-jobs";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

import type { AuthViewer } from "./use-auth-viewer";

export type AccountSyncStatus = "local" | "syncing" | "synced" | "error";

const STATE_COLUMNS = [
  "user_id",
  "owned_skills",
  "career_preferences",
  "saved_job_ids",
  "application_stages",
  "followed_company_slugs",
  "updated_at",
].join(",");

const LEGACY_STATE_COLUMNS = [
  "user_id",
  "owned_skills",
  "career_preferences",
  "saved_job_ids",
  "application_stages",
  "updated_at",
].join(",");

function isMissingFollowedCompaniesColumn(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message =
    typeof candidate.message === "string"
      ? candidate.message.toLocaleLowerCase("en-US")
      : "";
  return (
    (code === "42703" || code === "PGRST204") &&
    message.includes("followed_company_slugs")
  );
}

function sameState(left: AccountCareerState, right: AccountCareerState) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useAccountStateSync(viewer: AuthViewer | null) {
  const [status, setStatus] = useState<AccountSyncStatus>("local");

  useEffect(() => {
    if (!viewer) {
      setStatus("local");
      return;
    }

    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setStatus("error");
      return;
    }
    const client = supabase;
    const activeViewer = viewer;

    let active = true;
    let synced = false;
    let dirty = false;
    let saving = false;
    let remoteSupportsFollowedCompanies = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function writeRemote(value: AccountCareerState) {
      const { error } = await client
        .from("user_career_states")
        .upsert(
          remoteSupportsFollowedCompanies
            ? accountCareerStateToRow(activeViewer.id, value)
            : accountCareerStateToLegacyRow(activeViewer.id, value),
          {
            onConflict: "user_id",
          },
        );
      if (error) throw error;
    }

    async function readRemote() {
      const current = await client
        .from("user_career_states")
        .select(STATE_COLUMNS)
        .eq("user_id", activeViewer.id)
        .maybeSingle();
      if (!current.error) return current.data;
      if (!isMissingFollowedCompaniesColumn(current.error)) throw current.error;

      remoteSupportsFollowedCompanies = false;
      const legacy = await client
        .from("user_career_states")
        .select(LEGACY_STATE_COLUMNS)
        .eq("user_id", activeViewer.id)
        .maybeSingle();
      if (legacy.error) throw legacy.error;
      return legacy.data;
    }

    async function flush() {
      if (saving || !active || !synced) return;
      saving = true;
      try {
        while (dirty && active) {
          dirty = false;
          await writeRemote(readBrowserAccountState());
        }
        if (active) setStatus("synced");
      } catch {
        if (active) setStatus("error");
      } finally {
        saving = false;
      }
    }

    function scheduleSave() {
      if (!active || !synced) return;
      dirty = true;
      setStatus("syncing");
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), 450);
    }

    const unsubscribe = [
      subscribeOwnedSkills(scheduleSave),
      subscribeCareerPreferences(scheduleSave),
      subscribeSavedJobs(scheduleSave),
      subscribeJobApplicationStages(scheduleSave),
      subscribeFollowedCompanies(scheduleSave),
    ];

    async function reconcile() {
      setStatus("syncing");
      try {
        const data = await readRemote();

        const merged = mergeAccountCareerState(
          readBrowserAccountState(),
          accountCareerStateFromRow(data as Partial<AccountCareerStateRow> | null),
        );
        await writeRemote(merged);

        const latest = mergeAccountCareerState(
          readBrowserAccountState(),
          merged,
        );
        writeBrowserAccountState(latest);
        synced = true;
        if (!sameState(latest, merged)) {
          dirty = true;
          await flush();
        } else if (active) {
          setStatus("synced");
        }
      } catch {
        if (active) setStatus("error");
      }
    }

    void reconcile();
    return () => {
      active = false;
      synced = false;
      if (timer) clearTimeout(timer);
      unsubscribe.forEach((stop) => stop());
    };
  }, [viewer]);

  return status;
}
