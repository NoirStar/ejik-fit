function hasHangulFinalConsonant(value: string) {
  const last = value.at(-1);
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

export function withObjectParticle(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return `${trimmed}${hasHangulFinalConsonant(trimmed) ? "을" : "를"}`;
}
