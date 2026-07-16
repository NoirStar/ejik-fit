const CACHE_SECONDS = 60 * 60 * 24 * 7;
const MAX_LOGO_BYTES = 2_000_000;

const OFFICIAL_LOGO_URLS: Readonly<Record<string, string>> = {
  "42dot": "https://www.42dot.ai/favicon.ico",
  airwallex:
    "https://careers.airwallex.com/wp-content/uploads/2024/03/cropped-airwallex-favicon-192x192.png",
  "amd-korea":
    "https://cms.jibecdn.com/prod/amd/assets/FAVICON-en-us-1666203559098.ico",
  "applied-intuition":
    "https://www.appliedintuition.com/icon1.png?icon1.488d774c.png",
  "amazon-web-services-korea":
    "https://static.amazon.jobs/assets/favicon-933ee4605ae64f3181e0fcd88f9205be7b5f8a15643c342e53a9f03bb673732c.ico",
  "apple-korea": "https://www.apple.com/favicon.ico",
  allganize:
    "https://profiles.greetinghr.com/group/b2951f01-33fc-45df-a24b-d7ebe8e63cae",
  banksalad:
    "https://corp.banksalad.com/icons/icon-512x512.png?v=69e2d370b28e13a1369b649141c67ed7",
  bithumb:
    "https://profiles.greetinghr.com/group/1ebf8172-b186-49e5-b8de-eb4ae4d14b64",
  buzzvil:
    "https://profiles.greetinghr.com/group/f23ad931-b183-40f1-9b66-01770fc87960",
  bucketplace:
    "https://profiles.greetinghr.com/group/45034abc-f3db-430a-9361-d6fe581ba406",
  "channel-corporation": "https://channel.io/logo.webp",
  class101:
    "https://image.ninehire.com/homepage/f20ace90-8932-11f0-8815-d9c0c4c32872/image/d5c43c50-d5c0-11f0-be5c-cf61d3aa942b.png",
  cheiron: "https://www.cheiron.bio/apple-touch-icon.png",
  "celonis-korea": "https://www.celonis.com/favicon.ico",
  "clo-virtual-fashion":
    "https://cf.clovirtualfashion.com/web/_next/static/images/favicon_192x192.png",
  "cj-olivenetworks":
    "https://www.cjolivenetworks.co.kr/images/common/favicon_196.png",
  cognite: "https://www.cognite.com/icon.png?icon.08484x9h5icrf.png",
  com2us:
    "https://infra1-static.recruiter.co.kr/builder/2025/03/24/a0e8387d-0ad0-4b6a-b918-a0cbbd55e79d.png",
  cohere: "https://cohere.com/apple-touch-icon.png",
  coupang: "https://www.coupang.jobs/favicon.ico",
  crowdworks:
    "https://framerusercontent.com/images/p8rA85A5992NgoBozIv5mHhzWBU.png",
  "carat-ai":
    "https://opening-attachments.greetinghr.com/2024-07-30/287e8035-1f50-46ae-a75a-3e91d208cee3/app_icon.png",
  daangn: "https://careers.daangn.com/apple-touch-icon.png",
  databricks:
    "https://www.databricks.com/en-website-assets/icons/icon-96x96.png?v=c9b9916c3b27dc51866c46b79a6e9b88",
  datadog: "https://corp.dd-static.net/img/favicons/apple-touch-icon.png",
  dable:
    "https://profiles.greetinghr.com/group/b3c84141-fa0e-4848-9c1d-5f7294c8f627",
  dnotitia: "https://dnotitia-recruit.com/logo.png",
  "deepauto-ai": "https://deepauto.ai/icon.png?icon.3bd11c4c.png",
  devsisters:
    "https://profiles.greetinghr.com/group/6c261b05-a17f-4749-93dc-7546246c217f",
  bitsensing:
    "https://profiles.greetinghr.com/group/99b5d524-240f-45f9-82d3-789cbc07c4e2",
  dunamu: "https://careers.dunamu.com/favicon.png",
  deepnoid:
    "https://profiles.greetinghr.com/group/52e7484b-ffef-47e8-bd66-774309ad01d5",
  enerzai:
    "https://profiles.greetinghr.com/group/af5e4e1b-d4a3-4bbb-bab2-9c963848f958",
  exem: "https://www.ex-em.com/apple-icon.png",
  finda:
    "https://profiles.greetinghr.com/group/07b16511-6dcd-4732-bb25-d0df0164ddd5",
  fieldguide:
    "https://www.fieldguide.io/hubfs/601010ba543c954d3c14cb44_favicon-32x32.png",
  featuring:
    "https://profiles.greetinghr.com/group/2af17e75-ced7-40f4-ab86-91d67391d224",
  "friendli-ai": "https://friendli.ai/favicon/apple-touch-icon.png",
  "furiosa-ai":
    "https://cdn.prod.website-files.com/69289524195a1f9e06ade49b/6980d60ac29ab24693b8aadd_Furiosa_Favicon.png",
  "gauss-labs":
    "https://cdn.prod.website-files.com/6858a6f343e28528569197fe/686f212ea17026a1afde7187_icon_1.png",
  hyperconnect: "https://career.hyperconnect.com/icons/icon-192x192.png",
  hyperaccel:
    "https://profiles.greetinghr.com/group/2ba952e4-4c70-4e1f-9d6f-55195de575e5",
  hutom:
    "https://assets.roundhr.com/upload/user/organization/26964/temp/1736151128465/hutom_logo.png",
  hopae:
    "https://framerusercontent.com/images/o6Zk0QGmUwwlQW8tAtkUoeni8Q.svg",
  "hyundai-autoever":
    "https://profiles.greetinghr.com/group/15ac956f-bf20-4a9d-8327-232c5ddfade8",
  "hyundai-motor":
    "https://www.hyundai.com/static/images/common/favicon/apple-touch-icon.png",
  gccompany:
    "https://profiles.greetinghr.com/group/84df646b-eb2b-460f-bb7c-82eeba1ab95f",
  "google-korea": "https://www.google.com/favicon.ico",
  gear2:
    "https://assets.roundhr.com/upload/site/favicon/1928/1719299110201/%EB%A1%9C%EA%B3%A0.PNG",
  korbit:
    "https://profiles.greetinghr.com/group/e524bcb4-5dff-4400-bd42-7fb6a1cb7069",
  kmong:
    "https://opening-attachments.greetinghr.com/2025-12-03/330d1a88-4c51-4a8e-bcd0-5b35956b9e5e/kmong__green.png",
  krafton:
    "https://s2-recruiting.cdn.greenhouse.io/external_greenhouse_job_boards/logos/400/963/700/original/KRAFTON_1_Primary_Wordmark_Black_260112.png?1772068780",
  "kakao-mobility":
    "https://opening-attachments.greetinghr.com/2025-02-06/0e82fcb5-f39c-4d8f-8aee-f20e3efaa187/111.png",
  "kakao-pay":
    "https://profiles.greetinghr.com/group/2725e89d-5ab0-409e-973a-22b9c2e4c492",
  "kakao-games": "https://www.kakaogamescorp.com/favicon.ico",
  "kakao-enterprise":
    "https://profiles.greetinghr.com/group/a163f8c5-f9aa-44da-b5a3-1425303180e1",
  "kakao-style":
    "https://image.ninehire.com/homepage/1573cfe0-2c72-11ef-950a-65a32c77a0c3/image/65e55ba0-5b1b-11f0-acb4-7b0599a7f9c9.png",
  "kakao-healthcare":
    "https://image.ninehire.com/homepage/48b8c300-ac2c-11ed-9a7f-25af3e3b8401/bd23e840-ed5a-11ed-bef0-33cdfeb3dfc8.png",
  kia: "https://www.kia.com/content/dam/kwp/kr/ko/common/favicon.ico",
  kt: "https://recruit.kt.com/favicon.ico",
  kurly:
    "https://profiles.greetinghr.com/group/3e0a29fa-27a0-457f-be78-2e617e9cb86f",
  lambda256:
    "https://profiles.greetinghr.com/group/ca2fcf93-ab3c-41d1-8920-1c76d354fe7c",
  lawcompany: "https://www.lawtalk.co.kr/favicon.ico",
  "lg-electronics":
    "https://globalcareers.lge.com/gcr-content/og_image_lge_careers.png",
  "lg-cns":
    "https://www.lgcns.com/etc.clientlibs/lgcns/clientlibs/clientlib-site/resources/image/favicon.ico",
  "line-plus":
    "https://vos.line-scdn.net/landpress-content-v2-3ub8nanc40829phmlme9ov4o/1708056773171.png",
  lunit:
    "https://d2y4rc9q318ytb.cloudfront.net/accounts/f89ab03e-534e-40eb-9e02-da5a3ef0432d/192x192/1710763576734-12aa460e.png",
  makinarocks:
    "https://profiles.greetinghr.com/group/900e83ac-2ad7-42aa-9f2a-306e88914acf",
  marqvision:
    "https://cdn.prod.website-files.com/5e51f2cd33d368869635e146/68c77f69fc99ad99932476f3_favicon_gradient_small.png",
  musinsa:
    "https://profiles.greetinghr.com/group/f92732f3-3e8d-4714-93ed-57f672c139b5",
  neowiz:
    "https://cdn.neowiz.com/neowiz-site/assets/images/favicons/android-icon-72x72.png",
  nexon: "https://careers.nexon.com/favicon.ico",
  moloco:
    "https://cdn.prod.website-files.com/6237fca0466ffd9274a1dbdd/6837add3314e91dd48e16dec_Moloco-Webclip.png",
  mobilint:
    "https://static.wixstatic.com/media/4ddc53_0c6968a29344412dae160febf8dfa1d2%7Emv2.png/v1/fill/w_192%2Ch_192%2Clg_1%2Cusm_0.66_1.00_0.01/4ddc53_0c6968a29344412dae160febf8dfa1d2%7Emv2.png",
  moreh:
    "https://profiles.greetinghr.com/group/2a79989e-53a7-4c80-8c9f-0af7d8677a38",
  "megazone-cloud": "https://www.megazone.com/favicon_BK_152.png",
  "microsoft-korea": "https://www.microsoft.com/favicon.ico?v2",
  myrealtrip:
    "https://profiles.greetinghr.com/group/fa02fbe6-3cef-443f-b7f6-31cef6cb9c8b",
  neubility:
    "https://profiles.greetinghr.com/group/91fe8697-42c9-4b65-ab87-903d8ce27d51",
  "nhn-kcp":
    "https://profiles.greetinghr.com/group/135690b4-a80e-4f3a-9589-388082488e7c",
  "nhn-group": "https://careers.nhn.com/images/meta/favicon_32x32.png",
  ncsoft:
    "https://careers.ncsoft.com/static/global/favicon/new-apple-icon-180x180.png?ver=20250925",
  "naver-cloud":
    "https://ssl.pstatic.net/static/ncp/img/ko/msg_logo_thumb.jpg",
  "naver-labs": "https://www.naverlabs.com/img/naver_labs_favicon.ico",
  "naver-webtoon":
    "https://recruit.webtoonscorp.com/share/tmplat/webtoon/img/og/webtoon_favicon_32_2025.ico",
  netmarble:
    "https://sgimage.netmarble.com/favicon/netmarble/favicon-180x180.png",
  "nvidia-korea": "https://www.nvidia.com/favicon.ico",
  "qualcomm-korea":
    "https://static.vscdn.net/images/careers/demo/qualcomm/1686215981::Qualcomm-Favicon.png",
  qanda:
    "https://profiles.greetinghr.com/group/68ac9ee2-98b0-4f1a-a9d2-ed029995a365",
  "openai-korea":
    "https://cdn.oaistatic.com/assets/favicon-180x180-od45eci6.webp",
  "nota-ai":
    "https://profiles.greetinghr.com/group/9c58dd87-aaec-4cc8-8a3f-6e93205d0df8",
  overdare: "https://static.overdare.com/meta/favicon.png",
  "indeep-ai":
    "https://assets.roundhr.com/upload/user/organization/28244/temp/1761270163295/%EB%AF%B8%EB%8B%88%EB%A1%9C%EA%B3%A0.png",
  portone:
    "https://profiles.greetinghr.com/group/91c1eb78-3ba1-435b-b883-d3c380594976",
  palantir: "https://www.palantir.com/favicon.ico",
  "pearl-abyss":
    "https://static.pearlcdn.com/asset/company/global/contents/img/common/favicon64.ico",
  "posco-dx": "https://www.poscodx.com/resources/favicon.ico",
  rebellions:
    "https://profiles.greetinghr.com/group/2dd3c0de-aa17-44f2-90cb-0788a948bcff",
  "reflection-ai": "https://reflection.ai/apple-touch-icon.png",
  ridi:
    "https://assets.roundhr.com/upload/user/organization/28759/temp/1772180743140/%EB%A6%AC%EB%94%94%20%EB%A1%9C%EA%B3%A0_%EB%A6%AC%EB%94%94%20%EB%B8%94%EB%A3%A8.png",
  rlwrld:
    "https://opening-attachments.greetinghr.com/2025-12-22/c31e70f9-eeed-4ca8-bb92-919bb8eed2cc/favi.png",
  "sap-korea":
    "https://cdn.udex.services.sap.com/dds/design-tokens/assets/logos/sap-logo.svg",
  "sap-korea-mark":
    "https://cdn.udex.services.sap.com/dds/design-tokens/assets/logos/sap-logo.svg",
  backpackr:
    "https://profiles.greetinghr.com/group/a0b6b9f8-ba05-4b3f-bab2-e05520d17971",
  "riot-games-korea":
    "https://www.riotgames.com/assets/img/meta/87021767499a895b42bbe1e6a9edaf27/apple-touch-icon-precomposed-180x180.png",
  "samsung-sds":
    "https://image.samsungsds.com/resource/kr/images/app_ico.gif",
  "samsung-electronics":
    "https://www.samsungcareers.com/assets/images/favicon.ico",
  "seoul-robotics":
    "https://images.squarespace-cdn.com/content/v1/64497cc5a1eda67135e1c952/545fe40f-a64c-4216-9acc-c901d761f053/favicon.ico?format=100w",
  sendbird: "https://sendbird.com/_nuxt/icons/icon_512x512.e709d1.png",
  shiftup: "https://shiftup.co.kr/img/favicon.ico",
  "sk-telecom": "https://www.sktelecom.com/favicon1.ico",
  "sk-hynix":
    "https://mis-prod-koce-skhynixhomepage-cdn-01-ep.azureedge.net/img/favicon.ico",
  "sk-signet": "https://www.sksignet.com/favicon.ico",
  "sk-siltron": "https://www.sksiltron.com/ko/imgs/cmm/apple-icon-144x144.png",
  smilegate:
    "https://careers.smilegate.com/assets/web/img/common/favicon.ico",
  "snj-lab":
    "https://assets.roundhr.com/upload/user/organization/2045/temp/1743028544270/logo_basic.png",
  socar: "https://www.socarcorp.kr/images/favicons/favicon_180x180.png",
  stradvision:
    "https://www.stradvision.com/image/favicon/apple-icon-180x180.png",
  scatterlab:
    "https://profiles.greetinghr.com/group/5202e150-b0d5-47e4-a3a1-a3a200e23267",
  snow: "https://snowcorp.com/img/favicon.ico",
  toss: "https://static.toss.im/tds/favicon/favicon-196x196.png",
  teamblind:
    "https://image.ninehire.com/homepage/06de3c70-c17b-11ee-a4e8-19ace188b0c8/d92dc290-c185-11ee-ba3a-8750bc4cda1d.png",
  "tmap-mobility": "https://www.tmapmobility.com/favicon.ico",
  "twelve-labs":
    "https://framerusercontent.com/images/rPgUJ0yBWlnbaATq5j4kUxflLE.png",
  ujet: "https://www.ujet.cx/favicon.ico",
  upstage:
    "https://profiles.greetinghr.com/group/b26b9ea2-f544-4f97-b3e6-5ab033440219",
  "vessl-ai":
    "https://assets.roundhr.com/upload/site/favicon/1146/1724160614927/color.png",
  wadiz:
    "https://profiles.greetinghr.com/group/96f6237b-fdf1-42fe-aa88-1ed92e407dc1",
  yanolja:
    "https://profiles.greetinghr.com/group/ffd2b389-294e-4546-88b3-5d35456a156f",
  wemade:
    "https://image.ninehire.com/homepage/83cdd300-13fa-11ee-a096-95051faa2e73/logo/6bfa5820-6af0-11f1-90eb-f327db58c8db.png",
  "wiz-korea": "https://www.wiz.io/favicon.png",
  wrtn:
    "https://opening-attachments.greetinghr.com/2026-02-04/7541c46c-0f18-4a14-9fd9-2f9c4cea4192/logo_full_profile_dark.png",
  "woowahan-brothers": "https://career.woowahan.com/favicon.ico",
  "hanwha-systems":
    "https://www.hanwhasystems.com/resources/img/pc/com/favicon.ico",
  zigbang:
    "https://profiles.greetinghr.com/group/e993711a-5f1c-45e0-b292-4ea939289952",
  "11st": "https://profiles.greetinghr.com/group/7660163f-40cd-404d-a894-567dd54b3993",
};

type LogoRouteContext = {
  params: Promise<{ logoKey: string }>;
};

function bytesMatch(bytes: Uint8Array, offset: number, signature: number[]) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function rasterContentType(body: ArrayBuffer) {
  const bytes = new Uint8Array(body);
  if (bytesMatch(bytes, 0, [137, 80, 78, 71, 13, 10, 26, 10])) {
    return "image/png";
  }
  if (bytesMatch(bytes, 0, [255, 216, 255])) return "image/jpeg";
  if (
    bytesMatch(bytes, 0, [71, 73, 70, 56, 55, 97]) ||
    bytesMatch(bytes, 0, [71, 73, 70, 56, 57, 97])
  ) {
    return "image/gif";
  }
  if (
    bytesMatch(bytes, 0, [82, 73, 70, 70]) &&
    bytesMatch(bytes, 8, [87, 69, 66, 80])
  ) {
    return "image/webp";
  }
  if (
    bytesMatch(bytes, 4, [102, 116, 121, 112]) &&
    (bytesMatch(bytes, 8, [97, 118, 105, 102]) ||
      bytesMatch(bytes, 8, [97, 118, 105, 115]))
  ) {
    return "image/avif";
  }
  if (bytesMatch(bytes, 0, [0, 0, 1, 0])) return "image/x-icon";
  return null;
}

function svgContentType(body: ArrayBuffer) {
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(body).trim();
  } catch {
    return null;
  }
  if (!/^(?:<\?xml[^>]*>\s*)?<svg(?:\s|>)/i.test(source)) return null;
  if (/<(?:script|foreignObject|iframe|object|embed)\b/i.test(source)) {
    return null;
  }
  if (/\son[a-z0-9_-]+\s*=/i.test(source)) return null;
  if (
    /(?:href|xlink:href)\s*=\s*["']\s*(?:javascript:|data:|https?:|\/\/)/i.test(
      source,
    )
  ) {
    return null;
  }
  if (/url\s*\(\s*["']?\s*(?:data:|https?:|\/\/)/i.test(source)) {
    return null;
  }
  return "image/svg+xml";
}

function errorResponse(status: number) {
  return new Response(null, {
    headers: { "Cache-Control": "public, max-age=300" },
    status,
  });
}

export async function GET(_request: Request, context: LogoRouteContext) {
  const { logoKey } = await context.params;
  const upstreamUrl = OFFICIAL_LOGO_URLS[logoKey];
  if (!upstreamUrl) return errorResponse(404);

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        Accept:
          "image/avif,image/webp,image/png,image/jpeg,image/gif,image/x-icon,image/svg+xml",
        "User-Agent": "ejik-fit-company-logo/1.0",
      },
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(5_000),
    });
    if (!upstream.ok) return errorResponse(502);

    const declaredSize = Number(upstream.headers.get("Content-Length"));
    if (Number.isFinite(declaredSize) && declaredSize > MAX_LOGO_BYTES) {
      return errorResponse(413);
    }

    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_LOGO_BYTES) return errorResponse(413);
    const contentType = rasterContentType(body) ?? svgContentType(body);
    if (!contentType) return errorResponse(415);

    return new Response(body, {
      headers: {
        "Cache-Control":
          `public, max-age=86400, s-maxage=${CACHE_SECONDS}, ` +
          "stale-while-revalidate=2592000",
        ...(contentType === "image/svg+xml"
          ? {
              "Content-Security-Policy":
                "default-src 'none'; style-src 'unsafe-inline'; sandbox",
            }
          : {}),
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
      status: 200,
    });
  } catch {
    return errorResponse(502);
  }
}
