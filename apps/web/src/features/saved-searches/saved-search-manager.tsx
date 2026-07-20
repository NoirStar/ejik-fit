"use client";

import {
  ArrowRight,
  BellRinging,
  MagnifyingGlass,
  Pause,
  PencilSimple,
  Play,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import {
  type FormEvent,
  useMemo,
  useState,
} from "react";

import { useAuthViewerContext } from "@/features/auth/auth-viewer-context";
import {
  MAX_SAVED_JOB_SEARCH_NAME_LENGTH,
  type SavedJobSearch,
  type SavedJobSearchCareerType,
} from "@/lib/saved-job-searches";
import type { SavedSearchEvaluationGroup } from "@/lib/saved-search-notifications";
import { skillCategoryLabel } from "@/lib/skill-categories";

import styles from "./saved-search-manager.module.css";
import { useSavedJobSearches } from "./use-saved-job-searches";
import { useSavedSearchEvaluation } from "./use-saved-search-evaluation";

const CAREER_LABELS: Record<
  Exclude<SavedJobSearchCareerType, "">,
  string
> = {
  new_comer: "신입",
  experienced: "경력",
  mixed: "신입·경력",
};

type PendingAction =
  | "rename"
  | "toggle"
  | "remove";

type RowActionState = {
  id: string;
  action: PendingAction;
} | null;

function jobsHref(search: SavedJobSearch) {
  const params = new URLSearchParams();
  if (search.query) params.set("q", search.query);
  if (search.category) params.set("category", search.category);
  if (search.careerType) {
    params.set("career_type", search.careerType);
  }
  const query = params.toString();
  return query ? `/jobs?${query}` : "/jobs";
}

function filterLabels(search: SavedJobSearch) {
  return [
    search.query ? `검색어 ${search.query}` : "",
    search.category ? skillCategoryLabel(search.category) : "",
    search.careerType ? CAREER_LABELS[search.careerType] : "",
  ].filter(Boolean);
}

function formatLastCheckedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "마지막 확인 시각 미상";
  return `마지막 확인 ${new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
  }).format(date)}`;
}

function evaluationBySearch(
  groups: SavedSearchEvaluationGroup[],
) {
  return new Map(groups.map((group) => [group.searchId, group]));
}

function LoadingState({
  message,
}: {
  message: string;
}) {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className={styles.statePanel}
    >
      <span aria-hidden="true" className={styles.loadingMark} />
      <div>
        <h1>{message}</h1>
        <p>잠시만 기다려 주세요.</p>
      </div>
    </section>
  );
}

type SavedSearchRowProps = {
  evaluation: SavedSearchEvaluationGroup | undefined;
  mutationError: string;
  onRemove(id: string): Promise<void>;
  onRename(id: string, name: string): Promise<boolean>;
  onToggle(search: SavedJobSearch): Promise<void>;
  pending: RowActionState;
  search: SavedJobSearch;
};

function SavedSearchRow({
  evaluation,
  mutationError,
  onRemove,
  onRename,
  onToggle,
  pending,
  search,
}: SavedSearchRowProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(search.name);
  const [renameFailed, setRenameFailed] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const labels = filterLabels(search);
  const isPending = pending?.id === search.id;
  const readyEvaluation =
    evaluation?.status === "ready" ? evaluation : null;

  function beginRename() {
    setName(search.name);
    setRenameFailed(false);
    setEditing(true);
    setConfirmingDelete(false);
  }

  async function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || isPending) return;
    const saved = await onRename(search.id, name);
    setRenameFailed(!saved);
    if (saved) setEditing(false);
  }

  return (
    <li className={styles.searchRow}>
      <div className={styles.rowMain}>
        <div className={styles.nameLine}>
          <h3 title={search.name}>{search.name}</h3>
          <span
            className={styles.statusBadge}
            data-enabled={search.enabled ? "true" : undefined}
          >
            {search.enabled ? "활성" : "일시 중지"}
          </span>
        </div>

        <ul aria-label={`${search.name} 검색 조건`} className={styles.filterList}>
          {labels.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>

        <div className={styles.rowMeta}>
          {readyEvaluation ? (
            <span data-numeric>
              현재 공식 공고 {readyEvaluation.total.toLocaleString("ko-KR")}건
            </span>
          ) : evaluation?.status === "error" ? (
            <span className={styles.unavailable}>공고 수 확인 실패</span>
          ) : (
            <span>공고 수 확인 중</span>
          )}
          <span
            className={
              search.enabled && readyEvaluation?.items.length
                ? styles.newCount
                : undefined
            }
            data-numeric
          >
            {search.enabled
              ? readyEvaluation
                ? `새로 확인 ${readyEvaluation.items.length.toLocaleString(
                    "ko-KR",
                  )}건`
                : "신규 공고 확인 중"
              : "일시 중지"}
          </span>
          <time dateTime={search.lastCheckedAt}>
            {formatLastCheckedAt(search.lastCheckedAt)}
          </time>
        </div>

        {editing && (
          <form className={styles.renameForm} onSubmit={submitRename}>
            <label htmlFor={`saved-search-name-${search.id}`}>
              저장 검색 이름
            </label>
            <div>
              <input
                aria-describedby={
                  renameFailed && mutationError
                    ? `saved-search-error-${search.id}`
                    : undefined
                }
                aria-invalid={renameFailed ? "true" : undefined}
                autoFocus
                id={`saved-search-name-${search.id}`}
                maxLength={MAX_SAVED_JOB_SEARCH_NAME_LENGTH}
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
              <button
                disabled={!name.trim() || isPending}
                type="submit"
              >
                이름 저장
              </button>
              <button
                disabled={isPending}
                onClick={() => setEditing(false)}
                type="button"
              >
                취소
              </button>
            </div>
          </form>
        )}

        {mutationError && (
          <p
            className={styles.rowError}
            id={`saved-search-error-${search.id}`}
            role="alert"
          >
            {mutationError}
          </p>
        )}
      </div>

      <div
        aria-label={`${search.name} 관리`}
        className={styles.rowActions}
        role="group"
      >
        <Link href={jobsHref(search)}>
          <MagnifyingGlass aria-hidden="true" size={15} />
          공고 보기
        </Link>
        <button
          disabled={isPending}
          onClick={beginRename}
          type="button"
        >
          <PencilSimple aria-hidden="true" size={15} />
          이름 수정
        </button>
        <button
          disabled={isPending}
          onClick={() => void onToggle(search)}
          type="button"
        >
          {search.enabled ? (
            <Pause aria-hidden="true" size={15} />
          ) : (
            <Play aria-hidden="true" size={15} />
          )}
          {search.enabled ? "일시 중지" : "다시 시작"}
        </button>
        {confirmingDelete ? (
          <div
            aria-label="저장 검색 삭제 확인"
            className={styles.deleteConfirm}
            role="group"
          >
            <button
              disabled={isPending}
              onClick={() => void onRemove(search.id)}
              type="button"
            >
              삭제 확인
            </button>
            <button
              disabled={isPending}
              onClick={() => setConfirmingDelete(false)}
              type="button"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            className={styles.deleteButton}
            disabled={isPending}
            onClick={() => {
              setEditing(false);
              setConfirmingDelete(true);
            }}
            type="button"
          >
            <Trash aria-hidden="true" size={15} />
            삭제
          </button>
        )}
      </div>
    </li>
  );
}

export function SavedSearchManager() {
  const { ready: authReady, viewer } = useAuthViewerContext();
  const savedSearches = useSavedJobSearches(viewer);
  const evaluation = useSavedSearchEvaluation(
    savedSearches.state.items,
    savedSearches.state.status,
    savedSearches.markChecked,
    { includePaused: true },
  );
  const [pending, setPending] = useState<RowActionState>(null);
  const [mutationErrors, setMutationErrors] = useState<
    Record<string, string>
  >({});
  const groupsBySearch = useMemo(
    () => evaluationBySearch(evaluation.state.groups),
    [evaluation.state.groups],
  );

  function clearMutationError(id: string) {
    setMutationErrors((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function renameSearch(id: string, name: string) {
    clearMutationError(id);
    setPending({ id, action: "rename" });
    let saved = false;
    try {
      saved = await savedSearches.rename(id, name);
    } catch {
      saved = false;
    } finally {
      setPending(null);
    }
    if (!saved) {
      setMutationErrors((current) => ({
        ...current,
        [id]: "이름을 변경하지 못했습니다. 다시 시도해 주세요.",
      }));
    }
    return saved;
  }

  async function toggleSearch(search: SavedJobSearch) {
    clearMutationError(search.id);
    setPending({ id: search.id, action: "toggle" });
    let saved = false;
    try {
      saved = await savedSearches.setEnabled(
        search.id,
        !search.enabled,
      );
    } catch {
      saved = false;
    } finally {
      setPending(null);
    }
    if (!saved) {
      setMutationErrors((current) => ({
        ...current,
        [search.id]: search.enabled
          ? "알림을 중지하지 못했습니다. 다시 시도해 주세요."
          : "알림을 다시 시작하지 못했습니다. 다시 시도해 주세요.",
      }));
    }
  }

  async function removeSearch(id: string) {
    clearMutationError(id);
    setPending({ id, action: "remove" });
    let removed = false;
    try {
      removed = await savedSearches.remove(id);
    } catch {
      removed = false;
    } finally {
      setPending(null);
    }
    if (!removed) {
      setMutationErrors((current) => ({
        ...current,
        [id]: "저장 검색을 삭제하지 못했습니다. 다시 시도해 주세요.",
      }));
    }
  }

  if (!authReady) {
    return (
      <main className={styles.page}>
        <LoadingState message="로그인 상태를 확인하고 있습니다." />
      </main>
    );
  }

  if (!viewer) {
    return (
      <main className={styles.page}>
        <section className={styles.statePanel}>
          <BellRinging aria-hidden="true" size={26} />
          <div>
            <h1>공고 알림</h1>
            <p>
              검색 조건을 계정에 저장하고 새로 확인된 공식 공고를 관리할 수
              있습니다.
            </p>
          </div>
          <Link href="/login?next=%2Fcareer%2Falerts">
            로그인하고 공고 알림 관리
            <ArrowRight aria-hidden="true" size={16} weight="bold" />
          </Link>
        </section>
      </main>
    );
  }

  if (
    savedSearches.state.status === "idle" ||
    savedSearches.state.status === "loading"
  ) {
    return (
      <main className={styles.page}>
        <LoadingState message="저장한 공고 검색을 불러오고 있습니다." />
      </main>
    );
  }

  if (
    savedSearches.state.status === "error" &&
    savedSearches.state.items.length === 0
  ) {
    return (
      <main className={styles.page}>
        <section className={styles.statePanel}>
          <WarningCircle aria-hidden="true" size={26} />
          <div>
            <h1>공고 알림</h1>
            <p role="alert">{savedSearches.state.error}</p>
          </div>
          <button onClick={() => void savedSearches.reload()} type="button">
            다시 시도
          </button>
        </section>
      </main>
    );
  }

  if (savedSearches.state.items.length === 0) {
    return (
      <main className={styles.page}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>MY JOB ALERTS</p>
          <h1>공고 알림</h1>
          <p>저장한 검색 조건과 새로 확인된 공식 공고를 관리합니다.</p>
        </header>
        <section className={styles.statePanel}>
          <BellRinging aria-hidden="true" size={26} />
          <div>
            <h2>저장한 공고 검색이 없습니다.</h2>
            <p>공고에서 검색어나 기술 분야를 선택한 뒤 알림을 저장해 보세요.</p>
          </div>
          <Link href="/jobs">
            공고에서 검색 저장하기
            <ArrowRight aria-hidden="true" size={16} weight="bold" />
          </Link>
        </section>
      </main>
    );
  }

  const hasEvaluationNotice =
    evaluation.state.status === "partial" ||
    evaluation.state.status === "error";

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>MY JOB ALERTS</p>
        <h1>공고 알림</h1>
        <p>
          저장한 검색 조건과 이직핏이 새로 확인한 기업 공식 공고를
          관리합니다.
        </p>
        <Link href="/jobs">
          새 검색 만들기
          <ArrowRight aria-hidden="true" size={15} weight="bold" />
        </Link>
      </header>

      <section
        aria-labelledby="saved-search-list-title"
        className={styles.listPanel}
      >
        <header className={styles.listHeader}>
          <div>
            <p>저장 검색</p>
            <h2 id="saved-search-list-title">알림 조건</h2>
          </div>
          <span data-numeric>
            {savedSearches.state.items.length.toLocaleString("ko-KR")}개
          </span>
        </header>

        {savedSearches.state.status === "error" && (
          <div className={styles.notice} role="alert">
            <WarningCircle aria-hidden="true" size={17} />
            <p>{savedSearches.state.error}</p>
            <button onClick={() => void savedSearches.reload()} type="button">
              목록 다시 불러오기
            </button>
          </div>
        )}

        {hasEvaluationNotice && (
          <div className={styles.notice} role="alert">
            <WarningCircle aria-hidden="true" size={17} />
            <p>{evaluation.state.error}</p>
            <button onClick={evaluation.refresh} type="button">
              공고 수 다시 확인
            </button>
          </div>
        )}

        {evaluation.state.status === "loading" && (
          <p aria-live="polite" className={styles.evaluationLoading}>
            현재 공식 공고와 새로 확인된 공고를 확인하고 있습니다.
          </p>
        )}

        <ul className={styles.searchList}>
          {savedSearches.state.items.map((search) => (
            <SavedSearchRow
              evaluation={groupsBySearch.get(search.id)}
              key={search.id}
              mutationError={mutationErrors[search.id] ?? ""}
              onRemove={removeSearch}
              onRename={renameSearch}
              onToggle={toggleSearch}
              pending={pending}
              search={search}
            />
          ))}
        </ul>

        <footer className={styles.listFooter}>
          <p>
            활성 알림은 이 페이지에서 정상 확인된 공식 공고만 새 공고로
            계산합니다. 일시 중지한 기간의 공고는 재개 후 신규 알림에
            포함하지 않습니다.
          </p>
        </footer>
      </section>
    </main>
  );
}
