import {
  clearCareerPreferences,
  EMPTY_CAREER_PREFERENCES,
  normalizeCareerPreferences,
  readCareerPreferences,
  writeCareerPreferences,
  type CareerPreferences,
} from "./career-preferences";
import {
  clearJobApplicationStages,
  normalizeJobApplicationStages,
  readJobApplicationStages,
  writeJobApplicationStages,
  type JobApplicationStages,
} from "./job-application-stages";
import {
  clearOwnedSkills,
  normalizeOwnedSkills,
  readOwnedSkills,
  writeOwnedSkills,
} from "./owned-skills";
import {
  clearFollowedCompanies,
  normalizeFollowedCompanySlugs,
  readFollowedCompanySlugs,
  writeFollowedCompanySlugs,
} from "./followed-companies";
import {
  clearSavedJobs,
  normalizeSavedJobIds,
  readSavedJobIds,
  writeSavedJobIds,
} from "./saved-jobs";

export type AccountCareerState = {
  ownedSkills: string[];
  careerPreferences: CareerPreferences;
  savedJobIds: string[];
  applicationStages: JobApplicationStages;
  followedCompanySlugs: string[];
};

export type AccountCareerStateRow = {
  user_id: string;
  owned_skills: unknown;
  career_preferences: unknown;
  saved_job_ids: unknown;
  application_stages: unknown;
  followed_company_slugs: unknown;
  updated_at: string;
};

export const EMPTY_ACCOUNT_CAREER_STATE: AccountCareerState = {
  ownedSkills: [],
  careerPreferences: { ...EMPTY_CAREER_PREFERENCES },
  savedJobIds: [],
  applicationStages: {},
  followedCompanySlugs: [],
};

const MAX_ACCOUNT_SKILLS = 100;
const MAX_ACCOUNT_SKILL_LENGTH = 100;

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function normalizeAccountCareerState(value: unknown): AccountCareerState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ...EMPTY_ACCOUNT_CAREER_STATE,
      careerPreferences: { ...EMPTY_CAREER_PREFERENCES },
    };
  }

  const candidate = value as Partial<AccountCareerState>;
  return {
    ownedSkills: normalizeOwnedSkills(
      stringArray(candidate.ownedSkills).filter(
        (skill) => skill.trim().length <= MAX_ACCOUNT_SKILL_LENGTH,
      ),
    ).slice(0, MAX_ACCOUNT_SKILLS),
    careerPreferences: normalizeCareerPreferences(candidate.careerPreferences),
    savedJobIds: normalizeSavedJobIds(stringArray(candidate.savedJobIds)),
    applicationStages: normalizeJobApplicationStages(candidate.applicationStages),
    followedCompanySlugs: normalizeFollowedCompanySlugs(
      stringArray(candidate.followedCompanySlugs),
    ),
  };
}

export function accountCareerStateFromRow(
  value: Partial<AccountCareerStateRow> | null,
): AccountCareerState {
  if (!value) return normalizeAccountCareerState(null);
  return normalizeAccountCareerState({
    ownedSkills: value.owned_skills,
    careerPreferences: value.career_preferences,
    savedJobIds: value.saved_job_ids,
    applicationStages: value.application_stages,
    followedCompanySlugs: value.followed_company_slugs,
  });
}

export function mergeAccountCareerState(
  browserValue: AccountCareerState,
  serverValue: AccountCareerState,
): AccountCareerState {
  const browser = normalizeAccountCareerState(browserValue);
  const server = normalizeAccountCareerState(serverValue);

  return {
    ownedSkills: normalizeAccountCareerState({
      ownedSkills: [...server.ownedSkills, ...browser.ownedSkills],
    }).ownedSkills,
    careerPreferences: normalizeCareerPreferences({
      careerCondition:
        browser.careerPreferences.careerCondition ||
        server.careerPreferences.careerCondition,
      targetDomain:
        browser.careerPreferences.targetDomain ||
        server.careerPreferences.targetDomain,
    }),
    savedJobIds: normalizeSavedJobIds([
      ...server.savedJobIds,
      ...browser.savedJobIds,
    ]),
    applicationStages: normalizeJobApplicationStages({
      ...server.applicationStages,
      ...browser.applicationStages,
    }),
    followedCompanySlugs: normalizeFollowedCompanySlugs([
      ...server.followedCompanySlugs,
      ...browser.followedCompanySlugs,
    ]),
  };
}

export function readBrowserAccountState(
  storage?: Storage | null,
): AccountCareerState {
  return {
    ownedSkills: readOwnedSkills(storage),
    careerPreferences: readCareerPreferences(storage),
    savedJobIds: readSavedJobIds(storage),
    applicationStages: readJobApplicationStages(storage),
    followedCompanySlugs: readFollowedCompanySlugs(storage),
  };
}

export function writeBrowserAccountState(
  value: AccountCareerState,
  storage?: Storage | null,
) {
  const normalized = normalizeAccountCareerState(value);
  writeOwnedSkills(normalized.ownedSkills, storage);
  writeCareerPreferences(normalized.careerPreferences, storage);
  writeSavedJobIds(normalized.savedJobIds, storage);
  writeJobApplicationStages(normalized.applicationStages, storage);
  writeFollowedCompanySlugs(normalized.followedCompanySlugs, storage);
  return normalized;
}

export function clearBrowserAccountState(storage?: Storage | null) {
  clearOwnedSkills(storage);
  clearCareerPreferences(storage);
  clearSavedJobs(storage);
  clearJobApplicationStages(storage);
  clearFollowedCompanies(storage);
}

export function accountCareerStateToRow(
  userId: string,
  value: AccountCareerState,
): AccountCareerStateRow {
  const normalized = normalizeAccountCareerState(value);
  return {
    user_id: userId,
    owned_skills: normalized.ownedSkills,
    career_preferences: normalized.careerPreferences,
    saved_job_ids: normalized.savedJobIds,
    application_stages: normalized.applicationStages,
    followed_company_slugs: normalized.followedCompanySlugs,
    updated_at: new Date().toISOString(),
  };
}

export function accountCareerStateToLegacyRow(
  userId: string,
  value: AccountCareerState,
): Omit<AccountCareerStateRow, "followed_company_slugs"> {
  const { followed_company_slugs: _followedCompanies, ...legacyRow } =
    accountCareerStateToRow(userId, value);
  return legacyRow;
}
