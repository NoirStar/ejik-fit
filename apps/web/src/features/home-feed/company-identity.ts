export type CompanyIdentity = {
  kind: "logo" | "initials";
  src?: string;
  alt: string;
  initials: string;
};

type VerifiedLogo = {
  aliases: string[];
  src: string;
  displayName: string;
};

const VERIFIED_LOGOS: VerifiedLogo[] = [
  {
    aliases: ["네이버", "naver", "naver corp", "naver corp."],
    src: "/company-logos/naver.svg",
    displayName: "네이버",
  },
];

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");
}

function initialsFor(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "?";

  const parts = trimmed.split(/[\s._-]+/).filter(Boolean);
  if (parts.length > 1) {
    return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  }
  if (/^[가-힣]/.test(trimmed)) return trimmed[0];
  return trimmed.slice(0, 2).toUpperCase();
}

export function companyIdentity(
  companyName: string,
  _sourceUrl?: string,
): CompanyIdentity {
  const normalized = normalize(companyName);
  const verified = VERIFIED_LOGOS.find((logo) =>
    logo.aliases.some((alias) => normalize(alias) === normalized),
  );
  const initials = initialsFor(companyName);

  if (verified) {
    return {
      kind: "logo",
      src: verified.src,
      alt: `${verified.displayName} 로고`,
      initials,
    };
  }

  return {
    kind: "initials",
    initials,
    alt: companyName.trim() || "회사",
  };
}
