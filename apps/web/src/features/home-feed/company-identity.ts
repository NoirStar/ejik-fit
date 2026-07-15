export type CompanyIdentity = {
  kind: "logo" | "initials";
  src?: string;
  alt: string;
  initials: string;
};

type VerifiedLogo = {
  aliases: string[];
  hosts: string[];
  src: string;
  displayName: string;
};

const VERIFIED_LOGOS: VerifiedLogo[] = [
  {
    aliases: ["네이버", "naver", "naver corp", "naver corp."],
    hosts: ["navercorp.com"],
    src: "/company-logos/naver.svg",
    displayName: "네이버",
  },
  {
    aliases: ["슈퍼센트", "supercent"],
    hosts: ["supercent.career.greetinghr.com"],
    src: "/company-logos/supercent.png",
    displayName: "슈퍼센트",
  },
  {
    aliases: ["sionic ai", "사이오닉 ai", "사이오닉 에이아이"],
    hosts: ["sionicai.career.greetinghr.com"],
    src: "/company-logos/sionic-ai.png",
    displayName: "Sionic AI",
  },
  {
    aliases: ["s2w", "에스투더블유"],
    hosts: ["s2w.career.greetinghr.com"],
    src: "/company-logos/s2w.png",
    displayName: "S2W",
  },
  {
    aliases: ["afi 뒤끝", "뒤끝"],
    hosts: ["thebackend.career.greetinghr.com"],
    src: "/company-logos/afi-backend.jpg",
    displayName: "AFI 뒤끝",
  },
  {
    aliases: ["넥스트증권", "next securities"],
    hosts: ["nextsecurities.career.greetinghr.com"],
    src: "/company-logos/next-securities.png",
    displayName: "넥스트증권",
  },
  {
    aliases: ["오누이", "onuii"],
    hosts: ["onuii.career.greetinghr.com"],
    src: "/company-logos/onuii.png",
    displayName: "오누이",
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

function hasTrustedSource(sourceUrl: string | undefined, hosts: string[]) {
  if (!sourceUrl) return false;

  try {
    const hostname = new URL(sourceUrl).hostname.toLocaleLowerCase("en-US");
    return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function companyIdentity(
  companyName: string,
  sourceUrl?: string,
): CompanyIdentity {
  const normalized = normalize(companyName);
  const verified = VERIFIED_LOGOS.find(
    (logo) =>
      logo.aliases.some((alias) => normalize(alias) === normalized) &&
      hasTrustedSource(sourceUrl, logo.hosts),
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
