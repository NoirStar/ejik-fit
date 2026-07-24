export type SkillGraphAnimationProfile = {
  warmupTicks: number;
  cooldownTicks: number;
  cooldownTime: number;
};

export function skillGraphAnimationProfile(
  reduceMotion: boolean,
): SkillGraphAnimationProfile {
  return reduceMotion
    ? {
        warmupTicks: 36,
        cooldownTicks: 0,
        cooldownTime: 0,
      }
    : {
        warmupTicks: 12,
        cooldownTicks: 36,
        cooldownTime: 1_200,
      };
}
