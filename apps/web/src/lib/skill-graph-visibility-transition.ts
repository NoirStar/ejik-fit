export type VisibilityTransition = {
  from: number;
  to: number;
  startedAt: number;
  duration: number;
};

function clampVisibility(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function visibilityAt(
  transition: VisibilityTransition,
  now: number,
  reduceMotion: boolean,
) {
  if (reduceMotion || transition.duration <= 0) {
    return clampVisibility(transition.to);
  }

  const progress = clampVisibility(
    (now - transition.startedAt) / transition.duration,
  );
  const eased = 1 - Math.pow(1 - progress, 3);
  return clampVisibility(
    transition.from + (transition.to - transition.from) * eased,
  );
}
