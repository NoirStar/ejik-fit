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
    aliases: ["42dot", "포티투닷", "42닷"],
    hosts: ["42dot.ai", "api.ashbyhq.com", "jobs.ashbyhq.com"],
    src: "/company-logo-assets/42dot",
    displayName: "42dot",
  },
  {
    aliases: ["트웰브랩스", "twelve labs", "twelvelabs"],
    hosts: ["api.ashbyhq.com", "jobs.ashbyhq.com", "twelvelabs.io"],
    src: "/company-logo-assets/twelve-labs",
    displayName: "트웰브랩스",
  },
  {
    aliases: ["루닛", "lunit"],
    hosts: ["apply.workable.com", "lunit.io"],
    src: "/company-logo-assets/lunit",
    displayName: "루닛",
  },
  {
    aliases: ["서울로보틱스", "seoul robotics"],
    hosts: [
      "boards-api.greenhouse.io",
      "job-boards.greenhouse.io",
      "seoulrobotics.org",
    ],
    src: "/company-logo-assets/seoul-robotics",
    displayName: "서울로보틱스",
  },
  {
    aliases: ["휴톰", "hutom"],
    hosts: ["hutom.recruit.roundhr.com"],
    src: "/company-logo-assets/hutom",
    displayName: "휴톰",
  },
  {
    aliases: ["snj lab", "snjlab", "에스엔제이랩"],
    hosts: ["snjlab.recruit.roundhr.com"],
    src: "/company-logo-assets/snj-lab",
    displayName: "SNJ LAB",
  },
  {
    aliases: ["인딥에이아이", "indeepai", "indeep ai", "인딥 ai"],
    hosts: ["indeepai.recruit.roundhr.com"],
    src: "/company-logo-assets/indeep-ai",
    displayName: "인딥에이아이",
  },
  {
    aliases: ["기어세컨드", "gear2", "gear 2"],
    hosts: ["gear2.recruit.roundhr.com"],
    src: "/company-logo-assets/gear2",
    displayName: "기어세컨드",
    surface: "dark",
  },
  {
    aliases: ["vessl ai", "vessl", "베슬 ai", "베슬에이아이"],
    hosts: ["vessl.recruit.roundhr.com"],
    src: "/company-logo-assets/vessl-ai",
    displayName: "VESSL AI",
  },
  {
    aliases: ["리디", "ridi", "리디(ridi)", "리디 주식회사"],
    hosts: ["ridi.recruit.roundhr.com"],
    src: "/company-logo-assets/ridi",
    displayName: "리디",
  },
  {
    aliases: ["뱅크샐러드", "banksalad", "bank salad"],
    hosts: [
      "banksalad.career.greetinghr.com",
      "banksalad.com",
      "www.banksalad.com",
    ],
    src: "/company-logo-assets/banksalad",
    displayName: "뱅크샐러드",
  },
  {
    aliases: ["빗썸", "bithumb"],
    hosts: ["career.bithumbcorp.com"],
    src: "/company-logo-assets/bithumb",
    displayName: "빗썸",
  },
  {
    aliases: ["버즈빌", "buzzvil"],
    hosts: ["buzzvil.career.greetinghr.com"],
    src: "/company-logo-assets/buzzvil",
    displayName: "버즈빌",
  },
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
  {
    aliases: ["넷마블", "netmarble"],
    hosts: ["career.netmarble.com"],
    src: "/company-logo-assets/netmarble",
    displayName: "넷마블",
  },
  {
    aliases: ["엔씨소프트", "ncsoft", "nc soft"],
    hosts: ["careers.ncsoft.com"],
    src: "/company-logo-assets/ncsoft",
    displayName: "엔씨소프트",
    surface: "dark",
  },
  {
    aliases: ["컴투스", "com2us"],
    hosts: ["com2us.recruiter.co.kr"],
    src: "/company-logo-assets/com2us",
    displayName: "컴투스",
  },
  {
    aliases: ["스마일게이트", "smilegate"],
    hosts: ["careers.smilegate.com"],
    src: "/company-logo-assets/smilegate",
    displayName: "스마일게이트",
  },
  {
    aliases: ["쿠팡", "coupang"],
    hosts: [
      "boards-api.greenhouse.io",
      "job-boards.greenhouse.io",
      "coupang.jobs",
    ],
    src: "/company-logo-assets/coupang",
    displayName: "쿠팡",
  },
  {
    aliases: ["현대자동차", "hyundai motor", "hyundai"],
    hosts: ["talent.hyundai.com", "career.hyundai.com"],
    src: "/company-logo-assets/hyundai-motor",
    displayName: "현대자동차",
  },
  {
    aliases: ["기아", "kia"],
    hosts: ["career.kia.com"],
    src: "/company-logo-assets/kia",
    displayName: "기아",
  },
  {
    aliases: ["SK텔레콤", "sk telecom", "skt"],
    hosts: ["skcareers.com"],
    src: "/company-logo-assets/sk-telecom",
    displayName: "SK텔레콤",
  },
  {
    aliases: ["삼성SDS", "samsung sds"],
    hosts: ["samsungcareers.com"],
    src: "/company-logo-assets/samsung-sds",
    displayName: "삼성SDS",
  },
  {
    aliases: ["EXEM", "엑셈"],
    hosts: ["ex-em.career.greetinghr.com"],
    src: "/company-logo-assets/exem",
    displayName: "EXEM",
  },
  {
    aliases: ["카카오게임즈", "kakao games", "kakaogames"],
    hosts: ["recruit.kakaogames.com"],
    src: "/company-logo-assets/kakao-games",
    displayName: "카카오게임즈",
  },
  {
    aliases: ["컬리", "kurly", "마켓컬리"],
    hosts: ["kurly.career.greetinghr.com"],
    src: "/company-logo-assets/kurly",
    displayName: "컬리",
  },
  {
    aliases: ["하이퍼커넥트", "hyperconnect"],
    hosts: ["jobs.lever.co", "api.lever.co", "career.hyperconnect.com"],
    src: "/company-logo-assets/hyperconnect",
    displayName: "하이퍼커넥트",
  },
  {
    aliases: ["마이리얼트립", "myrealtrip", "my real trip"],
    hosts: ["myrealtrip.career.greetinghr.com"],
    src: "/company-logo-assets/myrealtrip",
    displayName: "마이리얼트립",
  },
  {
    aliases: ["와디즈", "wadiz"],
    hosts: ["job.wadiz.kr"],
    src: "/company-logo-assets/wadiz",
    displayName: "와디즈",
  },
  {
    aliases: ["여기어때컴퍼니", "여기어때", "gc company", "gccompany"],
    hosts: ["gccompany.career.greetinghr.com"],
    src: "/company-logo-assets/gccompany",
    displayName: "여기어때컴퍼니",
  },
  {
    aliases: ["스캐터랩", "scatter lab", "scatterlab"],
    hosts: ["scatterlab.co.kr"],
    src: "/company-logo-assets/scatterlab",
    displayName: "스캐터랩",
  },
  {
    aliases: ["채널코퍼레이션", "채널톡", "channel corporation", "channel talk"],
    hosts: ["channel.io"],
    src: "/company-logo-assets/channel-corporation",
    displayName: "채널코퍼레이션",
  },
  {
    aliases: ["핀다", "finda"],
    hosts: ["finda.career.greetinghr.com"],
    src: "/company-logo-assets/finda",
    displayName: "핀다",
  },
  {
    aliases: ["딥노이드", "deepnoid", "deep noid"],
    hosts: ["deepnoid.career.greetinghr.com"],
    src: "/company-logo-assets/deepnoid",
    displayName: "딥노이드",
  },
  {
    aliases: ["에너자이", "enerzai"],
    hosts: ["enerzai.career.greetinghr.com"],
    src: "/company-logo-assets/enerzai",
    displayName: "에너자이",
  },
  {
    aliases: ["퓨리오사AI", "퓨리오사에이아이", "furiosa ai", "furiosaai"],
    hosts: ["api.ashbyhq.com", "furiosa.ai", "jobs.ashbyhq.com"],
    src: "/company-logo-assets/furiosa-ai",
    displayName: "퓨리오사AI",
  },
  {
    aliases: ["Fieldguide", "field guide"],
    hosts: ["api.ashbyhq.com", "fieldguide.io", "jobs.ashbyhq.com"],
    src: "/company-logo-assets/fieldguide",
    displayName: "Fieldguide",
  },
  {
    aliases: ["FriendliAI", "Friendli AI", "프렌들리AI", "프렌들리에이아이"],
    hosts: ["api.ashbyhq.com", "friendli.ai", "jobs.ashbyhq.com"],
    src: "/company-logo-assets/friendli-ai",
    displayName: "FriendliAI",
  },
  {
    aliases: ["Gauss Labs", "가우스랩스", "gausslabs"],
    hosts: ["api.lever.co", "gausslabs.ai", "jobs.lever.co"],
    src: "/company-logo-assets/gauss-labs",
    displayName: "Gauss Labs",
  },
  {
    aliases: ["Palantir Technologies", "Palantir", "팔란티어"],
    hosts: ["api.lever.co", "palantir.com", "jobs.lever.co"],
    src: "/company-logo-assets/palantir",
    displayName: "Palantir Technologies",
  },
  {
    aliases: ["Databricks", "데이터브릭스"],
    hosts: ["boards-api.greenhouse.io", "databricks.com"],
    src: "/company-logo-assets/databricks",
    displayName: "Databricks",
  },
  {
    aliases: ["Airwallex", "에어월렉스"],
    hosts: ["airwallex.com", "api.ashbyhq.com", "jobs.ashbyhq.com"],
    src: "/company-logo-assets/airwallex",
    displayName: "Airwallex",
  },
  {
    aliases: ["Applied Intuition", "어플라이드 인튜이션"],
    hosts: ["appliedintuition.com", "api.ashbyhq.com", "jobs.ashbyhq.com"],
    src: "/company-logo-assets/applied-intuition",
    displayName: "Applied Intuition",
  },
  {
    aliases: ["Reflection AI", "리플렉션 AI"],
    hosts: ["reflection.ai", "api.ashbyhq.com", "jobs.ashbyhq.com"],
    src: "/company-logo-assets/reflection-ai",
    displayName: "Reflection AI",
  },
  {
    aliases: ["Cheiron", "케이론"],
    hosts: ["cheiron.bio", "api.ashbyhq.com", "jobs.ashbyhq.com"],
    src: "/company-logo-assets/cheiron",
    displayName: "Cheiron",
  },
  {
    aliases: ["Cohere", "코히어"],
    hosts: ["cohere.com", "api.ashbyhq.com", "jobs.ashbyhq.com"],
    src: "/company-logo-assets/cohere",
    displayName: "Cohere",
  },
  {
    aliases: ["Datadog", "데이터독"],
    hosts: [
      "datadoghq.com",
      "boards-api.greenhouse.io",
      "job-boards.greenhouse.io",
    ],
    src: "/company-logo-assets/datadog",
    displayName: "Datadog",
  },
  {
    aliases: ["UJET", "유젯"],
    hosts: [
      "ujet.cx",
      "boards-api.greenhouse.io",
      "job-boards.greenhouse.io",
    ],
    src: "/company-logo-assets/ujet",
    displayName: "UJET",
  },
  {
    aliases: ["OVERDARE", "오버데어"],
    hosts: [
      "overdare.com",
      "boards-api.greenhouse.io",
      "job-boards.greenhouse.io",
    ],
    src: "/company-logo-assets/overdare",
    displayName: "OVERDARE",
  },
  {
    aliases: ["Cognite", "코그나이트"],
    hosts: [
      "cognite.com",
      "boards-api.greenhouse.io",
      "job-boards.greenhouse.io",
    ],
    src: "/company-logo-assets/cognite",
    displayName: "Cognite",
  },
  {
    aliases: ["CLO Virtual Fashion", "클로버추얼패션", "CLO"],
    hosts: ["clovirtualfashion.com", "api.lever.co", "jobs.lever.co"],
    src: "/company-logo-assets/clo-virtual-fashion",
    displayName: "CLO Virtual Fashion",
  },
  {
    aliases: [
      "Amazon Web Services Korea",
      "Amazon Web Services Korea LLC",
      "AWS Korea",
      "아마존웹서비스 코리아",
    ],
    hosts: ["amazon.jobs"],
    src: "/company-logo-assets/amazon-web-services-korea",
    displayName: "Amazon Web Services Korea",
  },
  {
    aliases: ["Apple Korea", "Apple", "애플 코리아", "애플"],
    hosts: ["jobs.apple.com", "apple.com"],
    src: "/company-logo-assets/apple-korea",
    displayName: "Apple Korea",
  },
  {
    aliases: ["Microsoft Korea", "Microsoft", "마이크로소프트 코리아"],
    hosts: ["apply.careers.microsoft.com", "careers.microsoft.com"],
    src: "/company-logo-assets/microsoft-korea",
    displayName: "Microsoft Korea",
  },
  {
    aliases: ["Qualcomm Korea", "Qualcomm", "퀄컴 코리아", "퀄컴"],
    hosts: ["careers.qualcomm.com", "qualcomm.com"],
    src: "/company-logo-assets/qualcomm-korea",
    displayName: "Qualcomm Korea",
  },
  {
    aliases: ["AMD Korea", "AMD", "에이엠디 코리아", "에이엠디"],
    hosts: ["careers.amd.com", "amd.com"],
    src: "/company-logo-assets/amd-korea",
    displayName: "AMD Korea",
  },
  {
    aliases: ["SAP Korea", "SAP", "SAP 코리아", "에스에이피 코리아"],
    hosts: ["jobs.sap.com", "sap.com"],
    src: "/company-logo-assets/sap-korea",
    displayName: "SAP Korea",
  },
  {
    aliases: ["Google Korea", "Google", "구글 코리아", "구글"],
    hosts: ["google.com", "careers.google.com"],
    src: "/company-logo-assets/google-korea",
    displayName: "Google Korea",
  },
  {
    aliases: ["NVIDIA Korea", "NVIDIA", "엔비디아 코리아", "엔비디아"],
    hosts: ["nvidia.wd5.myworkdayjobs.com", "nvidia.com"],
    src: "/company-logo-assets/nvidia-korea",
    displayName: "NVIDIA Korea",
  },
  {
    aliases: ["Riot Games Korea", "Riot Games", "라이엇 게임즈 코리아"],
    hosts: ["riotgames.com", "boards-api.greenhouse.io", "boards.greenhouse.io"],
    src: "/company-logo-assets/riot-games-korea",
    displayName: "Riot Games Korea",
  },
  {
    aliases: ["Wiz Korea", "Wiz", "위즈 코리아"],
    hosts: ["wiz.io", "boards-api.greenhouse.io", "boards.greenhouse.io"],
    src: "/company-logo-assets/wiz-korea",
    displayName: "Wiz Korea",
  },
  {
    aliases: ["Celonis Korea", "Celonis", "셀로니스 코리아"],
    hosts: ["celonis.com", "boards-api.greenhouse.io", "boards.greenhouse.io"],
    src: "/company-logo-assets/celonis-korea",
    displayName: "Celonis Korea",
  },
  {
    aliases: ["OpenAI Korea", "OpenAI", "오픈AI", "오픈에이아이"],
    hosts: ["openai.com", "api.ashbyhq.com", "jobs.ashbyhq.com"],
    src: "/company-logo-assets/openai-korea",
    displayName: "OpenAI Korea",
  },
  {
    aliases: ["백패커", "Backpackr", "아이디어스", "idus", "텀블벅", "Tumblbug"],
    hosts: ["backpackr.com", "idus.career.greetinghr.com"],
    src: "/company-logo-assets/backpackr",
    displayName: "백패커",
  },
  {
    aliases: ["에이블리코퍼레이션", "에이블리", "ably corporation", "ably"],
    hosts: ["ably.team", "tydtr0dj.ninehire.site"],
    src: "/company-logos/ably.svg",
    displayName: "에이블리코퍼레이션",
  },
  {
    aliases: ["LG전자", "lg electronics", "lge"],
    hosts: ["globalcareers.lge.com"],
    src: "/company-logo-assets/lg-electronics",
    displayName: "LG전자",
  },
  {
    aliases: ["LINE Plus", "라인플러스", "line plus"],
    hosts: ["careers.linecorp.com", "linepluscorp.com"],
    src: "/company-logo-assets/line-plus",
    displayName: "LINE Plus",
  },
  {
    aliases: ["CJ올리브네트웍스", "cj olive networks", "cj olivenetworks"],
    hosts: ["recruit.cj.net", "cjolivenetworks.co.kr"],
    src: "/company-logo-assets/cj-olivenetworks",
    displayName: "CJ올리브네트웍스",
  },
  {
    aliases: ["카카오페이", "kakao pay", "kakaopay"],
    hosts: ["kakaopay.career.greetinghr.com"],
    src: "/company-logo-assets/kakao-pay",
    displayName: "카카오페이",
  },
  {
    aliases: ["카카오모빌리티", "kakao mobility", "kakaomobility"],
    hosts: ["kakaomobility.career.greetinghr.com"],
    src: "/company-logo-assets/kakao-mobility",
    displayName: "카카오모빌리티",
  },
  {
    aliases: ["우아한형제들", "배달의민족", "woowahan brothers", "woowa"],
    hosts: ["career.woowahan.com"],
    src: "/company-logo-assets/woowahan-brothers",
    displayName: "우아한형제들",
  },
  {
    aliases: ["삼성전자", "samsung electronics"],
    hosts: ["samsungcareers.com"],
    src: "/company-logo-assets/samsung-electronics",
    displayName: "삼성전자",
  },
  {
    aliases: ["LG CNS", "엘지씨엔에스", "lgcns"],
    hosts: ["api.careers.lg.com", "lgcns.com"],
    src: "/company-logo-assets/lg-cns",
    displayName: "LG CNS",
  },
  {
    aliases: ["SK하이닉스", "sk hynix", "skhynix"],
    hosts: ["skcareers.com", "skhynix.com", "talent.skhynix.com"],
    src: "/company-logo-assets/sk-hynix",
    displayName: "SK하이닉스",
  },
  {
    aliases: ["KT", "케이티"],
    hosts: ["recruit.kt.com"],
    src: "/company-logo-assets/kt",
    displayName: "KT",
  },
  {
    aliases: ["포스코DX", "posco dx", "poscodx"],
    hosts: ["poscodx.com", "recruit.posco.com"],
    src: "/company-logo-assets/posco-dx",
    displayName: "포스코DX",
  },
  {
    aliases: ["넥슨", "nexon"],
    hosts: ["careers.nexon.com", "nexon.com"],
    src: "/company-logo-assets/nexon",
    displayName: "넥슨",
  },
  {
    aliases: ["펄어비스", "pearl abyss", "pearlabyss"],
    hosts: ["pearlabyss.com"],
    src: "/company-logo-assets/pearl-abyss",
    displayName: "펄어비스",
  },
  {
    aliases: ["네오위즈", "neowiz"],
    hosts: ["api.lever.co", "jobs.lever.co", "neowiz.com"],
    src: "/company-logo-assets/neowiz",
    displayName: "네오위즈",
  },
  {
    aliases: ["NHN KCP", "nhnkcp", "kcp"],
    hosts: ["kcp.career.greetinghr.com"],
    src: "/company-logo-assets/nhn-kcp",
    displayName: "NHN KCP",
  },
  {
    aliases: ["뉴빌리티", "neubility"],
    hosts: ["neubility.career.greetinghr.com"],
    src: "/company-logo-assets/neubility",
    displayName: "뉴빌리티",
  },
  {
    aliases: ["비트센싱", "bitsensing", "bitsensing inc"],
    hosts: ["bitsensing.career.greetinghr.com"],
    src: "/company-logo-assets/bitsensing",
    displayName: "비트센싱",
  },
  {
    aliases: ["현대오토에버", "hyundai autoever", "autoever"],
    hosts: ["hyundai-autoever.career.greetinghr.com"],
    src: "/company-logo-assets/hyundai-autoever",
    displayName: "현대오토에버",
  },
  {
    aliases: ["크래프톤", "krafton"],
    hosts: [
      "boards-api.greenhouse.io",
      "job-boards.greenhouse.io",
      "krafton.com",
    ],
    src: "/company-logo-assets/krafton",
    displayName: "크래프톤",
  },
  {
    aliases: ["한화시스템", "hanwha systems"],
    hosts: ["hanwhasystems.com", "hwadm.hanwhain.com"],
    src: "/company-logo-assets/hanwha-systems",
    displayName: "한화시스템",
  },
  {
    aliases: ["deepauto.ai", "deepauto ai", "딥오토"],
    hosts: ["deepauto-ai.career.greetinghr.com"],
    src: "/company-logo-assets/deepauto-ai",
    displayName: "DeepAuto.ai",
  },
  {
    aliases: ["로앤컴퍼니", "lawcompany", "law company"],
    hosts: ["lawcompany.career.greetinghr.com"],
    src: "/company-logo-assets/lawcompany",
    displayName: "로앤컴퍼니",
  },
  {
    aliases: ["시프트업", "shift up", "shiftup"],
    hosts: ["shiftup.co.kr"],
    src: "/company-logo-assets/shiftup",
    displayName: "시프트업",
  },
  {
    aliases: ["데브시스터즈", "devsisters"],
    hosts: ["careers.devsisters.com", "devsisters.com"],
    src: "/company-logo-assets/devsisters",
    displayName: "데브시스터즈",
  },
  {
    aliases: ["위메이드", "wemade"],
    hosts: ["recruit.wemade.com", "wemade.com"],
    src: "/company-logo-assets/wemade",
    displayName: "위메이드",
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
