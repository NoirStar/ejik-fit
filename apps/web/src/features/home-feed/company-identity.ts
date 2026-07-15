export type CompanyIdentity = {
  kind: "logo" | "initials";
  src?: string;
  surface?: "dark";
  alt: string;
  initials: string;
};

type VerifiedLogo = {
  aliases: string[];
  hosts: string[];
  src: string;
  displayName: string;
  surface?: "dark";
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
  {
    aliases: ["마키나락스", "makinarocks"],
    hosts: ["makinarocks.career.greetinghr.com"],
    src: "/company-logo-assets/makinarocks",
    displayName: "마키나락스",
  },
  {
    aliases: ["리벨리온", "rebellions"],
    hosts: ["rebellions.career.greetinghr.com"],
    src: "/company-logo-assets/rebellions",
    displayName: "리벨리온",
  },
  {
    aliases: ["코빗", "korbit"],
    hosts: ["korbit.career.greetinghr.com"],
    src: "/company-logo-assets/korbit",
    displayName: "코빗",
  },
  {
    aliases: ["람다256", "lambda256", "lambda 256"],
    hosts: ["lambda256.career.greetinghr.com"],
    src: "/company-logo-assets/lambda256",
    displayName: "람다256",
  },
  {
    aliases: ["업스테이지", "upstage"],
    hosts: ["careers.upstage.ai"],
    src: "/company-logo-assets/upstage",
    displayName: "업스테이지",
  },
  {
    aliases: ["노타ai", "nota ai", "nota"],
    hosts: ["career.nota.ai"],
    src: "/company-logo-assets/nota-ai",
    displayName: "노타AI",
  },
  {
    aliases: ["포트원", "portone", "port one"],
    hosts: ["portone.career.greetinghr.com"],
    src: "/company-logo-assets/portone",
    displayName: "포트원",
  },
  {
    aliases: ["캐럿ai", "carat ai", "carat"],
    hosts: ["carat.career.greetinghr.com"],
    src: "/company-logo-assets/carat-ai",
    displayName: "캐럿AI",
  },
  {
    aliases: ["뤼튼테크놀로지스", "뤼튼", "wrtn"],
    hosts: ["wrtn.career.greetinghr.com"],
    src: "/company-logo-assets/wrtn",
    displayName: "뤼튼테크놀로지스",
    surface: "dark",
  },
  {
    aliases: ["당근", "당근마켓", "daangn", "karrot"],
    hosts: ["careers.daangn.com"],
    src: "/company-logo-assets/daangn",
    displayName: "당근",
  },
  {
    aliases: ["무신사", "musinsa"],
    hosts: ["musinsacareers.com"],
    src: "/company-logo-assets/musinsa",
    displayName: "무신사",
  },
  {
    aliases: ["토스 커뮤니티", "토스", "toss", "toss community"],
    hosts: ["toss.im"],
    src: "/company-logo-assets/toss",
    displayName: "토스 커뮤니티",
  },
  {
    aliases: ["moloco", "몰로코"],
    hosts: ["boards-api.greenhouse.io", "job-boards.greenhouse.io"],
    src: "/company-logo-assets/moloco",
    displayName: "Moloco",
  },
  {
    aliases: ["sendbird", "센드버드"],
    hosts: ["boards-api.greenhouse.io", "job-boards.greenhouse.io"],
    src: "/company-logo-assets/sendbird",
    displayName: "Sendbird",
    surface: "dark",
  },
  {
    aliases: ["카카오뱅크", "kakaobank", "kakao bank"],
    hosts: ["recruit.kakaobank.com"],
    src: "/company-logos/kakaobank.svg",
    displayName: "카카오뱅크",
  },
  {
    aliases: ["쏘카", "socar"],
    hosts: ["socarcorp.kr", "socar.career.greetinghr.com"],
    src: "/company-logo-assets/socar",
    displayName: "쏘카",
  },
  {
    aliases: ["오늘의집", "버킷플레이스", "bucketplace", "ohouse"],
    hosts: ["bucketplace.com", "bucketplace.career.greetinghr.com"],
    src: "/company-logo-assets/bucketplace",
    displayName: "오늘의집",
  },
  {
    aliases: ["두나무", "dunamu"],
    hosts: ["careers.dunamu.com", "dunamu.com"],
    src: "/company-logo-assets/dunamu",
    displayName: "두나무",
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
      ...(verified.surface ? { surface: verified.surface } : {}),
    };
  }

  return {
    kind: "initials",
    initials,
    alt: companyName.trim() || "회사",
  };
}
