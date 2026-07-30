import {
  clearCareerPreferences,
  EMPTY_CAREER_PREFERENCES,
  normalizeCareerPreferences,
  readCareerPreferences,
  subscribeCareerPreferences,
  writeCareerPreferences,
  type CareerPreferences,
} from "./career-preferences";
import {
  clearCareerProfile,
  EMPTY_CAREER_PROFILE,
  normalizeCareerProfile,
  readCareerProfile,
  subscribeCareerProfile,
  writeCareerProfile,
  type CareerProfile,
} from "./career-profile";
import {
  clearJobApplicationStages,
  normalizeJobApplicationStages,
  readJobApplicationStages,
  subscribeJobApplicationStages,
  writeJobApplicationStages,
  type JobApplicationStages,
} from "./job-application-stages";
import {
  clearOwnedSkills,
  normalizeOwnedSkills,
  readOwnedSkills,
  subscribeOwnedSkills,
  writeOwnedSkills,
} from "./owned-skills";
import {
  clearFollowedCompanies,
  normalizeFollowedCompanySlugs,
  readFollowedCompanySlugs,
  subscribeFollowedCompanies,
  writeFollowedCompanySlugs,
} from "./followed-companies";
import {
  clearSavedJobs,
  normalizeSavedJobIds,
  readSavedJobIds,
  subscribeSavedJobs,
  writeSavedJobIds,
} from "./saved-jobs";
import {
  clearSavedJobGroups,
  normalizeSavedJobGroups,
  readSavedJobGroups,
  subscribeSavedJobGroups,
  writeSavedJobGroups,
  type SavedJobGroups,
} from "./saved-job-groups";

export type AccountCareerState = {
  ownedSkills: string[];
  careerPreferences: CareerPreferences;
  careerProfile: CareerProfile;
  savedJobIds: string[];
  savedJobGroups: SavedJobGroups;
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
  careerProfile: { ...EMPTY_CAREER_PROFILE, skillUsage: {} },
  savedJobIds: [],
  savedJobGroups: {},
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeAccountCareerState(value: unknown): AccountCareerState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ...EMPTY_ACCOUNT_CAREER_STATE,
      careerPreferences: { ...EMPTY_CAREER_PREFERENCES },
      careerProfile: { ...EMPTY_CAREER_PROFILE, skillUsage: {} },
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
    careerProfile: normalizeCareerProfile(candidate.careerProfile),
    savedJobIds: normalizeSavedJobIds(stringArray(candidate.savedJobIds)),
    savedJobGroups: normalizeSavedJobGroups(candidate.savedJobGroups),
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
  const storedPreferences = isRecord(value.career_preferences)
    ? value.career_preferences
    : {};
  return normalizeAccountCareerState({
    ownedSkills: value.owned_skills,
    careerPreferences: storedPreferences,
    careerProfile: storedPreferences.profile,
    savedJobIds: value.saved_job_ids,
    savedJobGroups: storedPreferences.savedJobGroups,
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

  const careerProfile = normalizeCareerProfile({
    currentRole: browser.careerProfile.currentRole || server.careerProfile.currentRole,
    pastRoles: [...server.careerProfile.pastRoles, ...browser.careerProfile.pastRoles],
    experienceYears:
      browser.careerProfile.experienceYears ?? server.careerProfile.experienceYears,
    responsibilities:
      browser.careerProfile.responsibilities || server.careerProfile.responsibilities,
    workTypes: [...server.careerProfile.workTypes, ...browser.careerProfile.workTypes],
    industryExperience: [
      ...server.careerProfile.industryExperience,
      ...browser.careerProfile.industryExperience,
    ],
    currentDomain:
      browser.careerProfile.currentDomain || server.careerProfile.currentDomain,
    keepExperience:
      browser.careerProfile.keepExperience || server.careerProfile.keepExperience,
    interestDomains: [
      ...server.careerProfile.interestDomains,
      ...browser.careerProfile.interestDomains,
    ],
    excludedDomains: [
      ...server.careerProfile.excludedDomains,
      ...browser.careerProfile.excludedDomains,
    ],
    preferredLocations: [
      ...server.careerProfile.preferredLocations,
      ...browser.careerProfile.preferredLocations,
    ],
    employmentTypes: [
      ...server.careerProfile.employmentTypes,
      ...browser.careerProfile.employmentTypes,
    ],
    careerLevel:
      browser.careerProfile.careerLevel || server.careerProfile.careerLevel,
    skillUsage: {
      ...server.careerProfile.skillUsage,
      ...browser.careerProfile.skillUsage,
    },
  });

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
    careerProfile,
    savedJobIds: normalizeSavedJobIds([
      ...server.savedJobIds,
      ...browser.savedJobIds,
    ]),
    savedJobGroups: normalizeSavedJobGroups({
      ...server.savedJobGroups,
      ...browser.savedJobGroups,
    }),
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
    careerProfile: readCareerProfile(storage),
    savedJobIds: readSavedJobIds(storage),
    savedJobGroups: readSavedJobGroups(storage),
    applicationStages: readJobApplicationStages(storage),
    followedCompanySlugs: readFollowedCompanySlugs(storage),
  };
}

export function subscribeBrowserAccountState(
  listener: (state: AccountCareerState) => void,
) {
  const emitCurrent = () => listener(readBrowserAccountState());
  const unsubscribe = [
    subscribeOwnedSkills(emitCurrent),
    subscribeCareerPreferences(emitCurrent),
    subscribeCareerProfile(emitCurrent),
    subscribeSavedJobs(emitCurrent),
    subscribeSavedJobGroups(emitCurrent),
    subscribeJobApplicationStages(emitCurrent),
    subscribeFollowedCompanies(emitCurrent),
  ];
  return () => unsubscribe.forEach((stop) => stop());
}

export function writeBrowserAccountState(
  value: AccountCareerState,
  storage?: Storage | null,
) {
  const normalized = normalizeAccountCareerState(value);
  writeOwnedSkills(normalized.ownedSkills, storage);
  writeCareerPreferences(normalized.careerPreferences, storage);
  writeCareerProfile(normalized.careerProfile, storage);
  writeSavedJobIds(normalized.savedJobIds, storage);
  writeSavedJobGroups(normalized.savedJobGroups, storage);
  writeJobApplicationStages(normalized.applicationStages, storage);
  writeFollowedCompanySlugs(normalized.followedCompanySlugs, storage);
  return normalized;
}

export function clearBrowserAccountState(storage?: Storage | null) {
  clearOwnedSkills(storage);
  clearCareerPreferences(storage);
  clearCareerProfile(storage);
  clearSavedJobs(storage);
  clearSavedJobGroups(storage);
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
    career_preferences: {
      ...normalized.careerPreferences,
      profile: normalized.careerProfile,
      savedJobGroups: normalized.savedJobGroups,
    },
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
