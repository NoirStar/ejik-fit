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
        warmupTicks: 72,
        cooldownTicks: 0,
        cooldownTime: 0,
      }
    : {
        warmupTicks: 24,
        cooldownTicks: 72,
        cooldownTime: 2_400,
      };
}
