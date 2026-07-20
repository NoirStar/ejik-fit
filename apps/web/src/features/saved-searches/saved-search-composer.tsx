"use client";

import Link from "next/link";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuthViewerContext } from "@/features/auth/auth-viewer-context";
import type { JobListFilters } from "@/features/jobs/job-list";
import {
  defaultSavedJobSearchName,
  hasSavedJobSearchFilter,
  MAX_SAVED_JOB_SEARCH_NAME_LENGTH,
  normalizeSavedJobSearchFilters,
} from "@/lib/saved-job-searches";

import styles from "./saved-search-composer.module.css";
import { useSavedJobSearches } from "./use-saved-job-searches";

const RESULT_MESSAGES = {
  created: "검색 조건을 저장했습니다.",
  duplicate: "이미 같은 조건을 저장했습니다.",
  limit: "저장 검색은 최대 10개까지 만들 수 있습니다.",
  error: "검색 조건을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.",
} as const;

type ResultStatus = keyof typeof RESULT_MESSAGES;

type SavedSearchComposerProps = {
  filters: JobListFilters;
  openOnReady?: boolean;
};

function loginHref(filters: JobListFilters) {
  const nextParams = new URLSearchParams();
  if (filters.query) nextParams.set("q", filters.query);
  if (filters.category) nextParams.set("category", filters.category);
  if (filters.careerType) {
    nextParams.set("career_type", filters.careerType);
  }
  nextParams.set("save_search", "1");

  const loginParams = new URLSearchParams({
    next: `/jobs?${nextParams.toString()}`,
  });
  return `/login?${loginParams.toString()}`;
}

export function SavedSearchComposer({
  filters,
  openOnReady = false,
}: SavedSearchComposerProps) {
  const { ready, viewer } = useAuthViewerContext();
  const savedSearches = useSavedJobSearches(viewer);
  const normalizedFilters = useMemo(
    () => normalizeSavedJobSearchFilters(filters),
    [filters.careerType, filters.category, filters.query],
  );
  const hasFilter = hasSavedJobSearchFilter(normalizedFilters);
  const defaultName = defaultSavedJobSearchName(normalizedFilters);
  const filterVersion = JSON.stringify([
    normalizedFilters.query,
    normalizedFilters.category,
    normalizedFilters.careerType,
  ]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ResultStatus | null>(null);
  const [composerFilterVersion, setComposerFilterVersion] =
    useState(filterVersion);
  const autoOpened = useRef(false);
  const activeFilterVersion = useRef(filterVersion);
  activeFilterVersion.current = filterVersion;
  const stateMatchesFilters = composerFilterVersion === filterVersion;

  useEffect(() => {
    if (stateMatchesFilters) return;

    autoOpened.current = false;
    setComposerFilterVersion(filterVersion);
    setOpen(false);
    setName(defaultName);
    setPending(false);
    setResult(null);
  }, [defaultName, filterVersion, stateMatchesFilters]);

  useEffect(() => {
    if (!openOnReady) {
      autoOpened.current = false;
      return;
    }
    if (
      autoOpened.current ||
      !ready ||
      !viewer ||
      !hasFilter
    ) {
      return;
    }

    autoOpened.current = true;
    setName(defaultName);
    setResult(null);
    setOpen(true);
  }, [defaultName, hasFilter, openOnReady, ready, viewer]);

  function openComposer() {
    if (!stateMatchesFilters || !viewer || !hasFilter) return;
    setName(defaultName);
    setResult(null);
    setOpen(true);
  }

  function closeComposer() {
    setOpen(false);
    setResult(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      pending ||
      !stateMatchesFilters ||
      savedSearches.state.status !== "ready" ||
      !hasFilter ||
      !name.trim()
    ) {
      return;
    }

    setPending(true);
    setResult(null);
    const submittedFilterVersion = filterVersion;
    try {
      const outcome = await savedSearches.create(normalizedFilters, name);
      if (activeFilterVersion.current !== submittedFilterVersion) return;
      setResult(outcome.status);
      if (outcome.status === "created") setOpen(false);
    } catch {
      if (activeFilterVersion.current === submittedFilterVersion) {
        setResult("error");
      }
    } finally {
      if (activeFilterVersion.current === submittedFilterVersion) {
        setPending(false);
      }
    }
  }

  const submitDisabled =
    pending ||
    !stateMatchesFilters ||
    savedSearches.state.status !== "ready" ||
    !hasFilter ||
    !name.trim();

  return (
    <div className={styles.composer}>
      {stateMatchesFilters && result === "created" ? (
        <div className={styles.success}>
          <p role="status">{RESULT_MESSAGES.created}</p>
          <Link href="/career/alerts">공고 알림 관리</Link>
        </div>
      ) : stateMatchesFilters && hasFilter && open && viewer ? (
        <form
          aria-label="검색 조건 저장"
          className={styles.form}
          onSubmit={handleSubmit}
        >
          <div className={styles.field}>
            <label htmlFor="saved-search-name">저장 검색 이름</label>
            <input
              id="saved-search-name"
              maxLength={MAX_SAVED_JOB_SEARCH_NAME_LENGTH}
              onChange={(event) =>
                setName(
                  event.currentTarget.value.slice(
                    0,
                    MAX_SAVED_JOB_SEARCH_NAME_LENGTH,
                  ),
                )
              }
              type="text"
              value={name}
            />
          </div>
          <div className={styles.formActions}>
            <button disabled={submitDisabled} type="submit">
              {pending ? "저장 중" : "검색 조건 저장"}
            </button>
            <button onClick={closeComposer} type="button">
              취소
            </button>
          </div>
          {result && (
            <p
              className={styles.result}
              data-tone={result === "error" ? "error" : "notice"}
              role={result === "error" ? "alert" : "status"}
            >
              {RESULT_MESSAGES[result]}
            </p>
          )}
        </form>
      ) : ready && !viewer && hasFilter ? (
        <Link className={styles.trigger} href={loginHref(filters)}>
          이 검색 저장
        </Link>
      ) : (
        <button
          className={styles.trigger}
          disabled={
            !stateMatchesFilters ||
            !ready ||
            !viewer ||
            !hasFilter
          }
          onClick={openComposer}
          type="button"
        >
          이 검색 저장
        </button>
      )}

      {!hasFilter && (
        <p className={styles.hint}>
          검색어, 기술 분야, 경력 조건 중 하나를 선택해 주세요.
        </p>
      )}
    </div>
  );
}
