import {
  MAX_SAVED_JOB_ID_LENGTH,
  MAX_SAVED_JOB_IDS,
} from "./saved-job-contract";
import {
  clearMigratedStorageValue,
  isMigratedStorageEventKey,
  readMigratedStorageValue,
  writeMigratedStorageValue,
} from "./browser-storage-migration";

const STORAGE_KEYS = {
  current: "careerfit:job-application-stages",
  legacy: ["ejik-fit:job-application-stages"],
} as const;
const CHANGE_EVENT = "careerfit:job-application-stages-change";

export const MAX_JOB_APPLICATION_STAGES = MAX_SAVED_JOB_IDS;

export const APPLICATION_STAGES = [
  { value: "", label: "단계 미설정" },
  { value: "preparing", label: "지원 준비" },
  { value: "applied", label: "지원 완료" },
  { value: "interview", label: "면접 진행" },
  { value: "offer", label: "처우·오퍼" },
  { value: "closed", label: "종료" },
] as const;

export type JobApplicationStageValue =
  (typeof APPLICATION_STAGES)[number]["value"];
export type JobApplicationStage = Exclude<JobApplicationStageValue, "">;
export type JobApplicationStages = Record<string, JobApplicationStage>;

type JobApplicationStagesListener = (stages: JobApplicationStages) => void;

const VALID_STAGES = new Set<JobApplicationStage>(
  APPLICATION_STAGES.flatMap((stage) =>
    stage.value ? [stage.value] : [],
  ),
);

function isJobApplicationStage(value: unknown): value is JobApplicationStage {
  return (
    typeof value === "string" &&
    VALID_STAGES.has(value as JobApplicationStage)
  );
}

export function applicationStageLabel(value: JobApplicationStageValue) {
  return (
    APPLICATION_STAGES.find((stage) => stage.value === value)?.label ??
    "단계 미설정"
  );
}

export function normalizeJobApplicationStages(
  value: unknown,
): JobApplicationStages {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const stages = new Map<string, JobApplicationStage>();
  for (const [rawId, rawStage] of Object.entries(value)) {
    const id = rawId.trim();
    if (
      !id ||
      id.length > MAX_SAVED_JOB_ID_LENGTH ||
      !isJobApplicationStage(rawStage)
    ) {
      continue;
    }
    stages.delete(id);
    stages.set(id, rawStage);
  }

  return Object.fromEntries(
    [...stages.entries()].slice(-MAX_JOB_APPLICATION_STAGES),
  );
}

function defaultStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readJobApplicationStages(
  storage = defaultStorage(),
): JobApplicationStages {
  if (!storage) return {};
  return readMigratedStorageValue(storage, STORAGE_KEYS, {
    parse(raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? normalizeJobApplicationStages(parsed)
          : null;
      } catch {
        return null;
      }
    },
    serialize: JSON.stringify,
  }) ?? {};
}

function notifyJobApplicationStagesChange(storage: Storage | null) {
  if (
    typeof window !== "undefined" &&
    storage !== null &&
    storage === defaultStorage()
  ) {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function clearJobApplicationStages(
  storage = defaultStorage(),
): JobApplicationStages {
  if (!storage) return {};
  clearMigratedStorageValue(storage, STORAGE_KEYS);
  notifyJobApplicationStagesChange(storage);
  return {};
}

export function writeJobApplicationStages(
  stages: unknown,
  storage = defaultStorage(),
): JobApplicationStages {
  const normalized = normalizeJobApplicationStages(stages);
  if (!storage) return {};
  const written = writeMigratedStorageValue(storage, STORAGE_KEYS, normalized, {
    parse: () => normalized,
    serialize: JSON.stringify,
  });
  if (!written) {
    return readJobApplicationStages(storage);
  }
  notifyJobApplicationStagesChange(storage);
  return normalized;
}

export function setJobApplicationStage(
  rawId: string,
  stage: JobApplicationStageValue,
  storage = defaultStorage(),
): JobApplicationStages {
  const id = rawId.trim();
  const current = readJobApplicationStages(storage);
  if (!id || id.length > MAX_SAVED_JOB_ID_LENGTH) return current;

  const next: JobApplicationStages = { ...current };
  delete next[id];
  if (stage && isJobApplicationStage(stage)) next[id] = stage;
  return writeJobApplicationStages(next, storage);
}

export function removeJobApplicationStage(
  id: string,
  storage = defaultStorage(),
) {
  return setJobApplicationStage(id, "", storage);
}

export function subscribeJobApplicationStages(
  listener: JobApplicationStagesListener,
) {
  if (typeof window === "undefined") return () => undefined;

  const emitCurrent = () => listener(readJobApplicationStages());
  const handleStorage = (event: StorageEvent) => {
    const browserStorage = defaultStorage();
    if (
      isMigratedStorageEventKey(event.key, STORAGE_KEYS) &&
      (!event.storageArea || event.storageArea === browserStorage)
    ) {
      emitCurrent();
    }
  };

  window.addEventListener(CHANGE_EVENT, emitCurrent);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, emitCurrent);
    window.removeEventListener("storage", handleStorage);
  };
}
