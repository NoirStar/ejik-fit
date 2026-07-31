from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal


ANALYSIS_VERSION = "career-evidence-v3.0"

DirectionKind = Literal["direct", "adjacent", "interest", "transition"]


@dataclass(frozen=True)
class DomainDefinition:
    id: str
    label: str
    title_terms: tuple[str, ...]
    responsibility_terms: tuple[str, ...]
    strong_skills: tuple[str, ...]
    supporting_skills: tuple[str, ...]
    work_types: tuple[str, ...]


DOMAIN_DEFINITIONS = (
    DomainDefinition(
        "backend",
        "백엔드",
        ("backend", "back-end", "백엔드", "서버 개발", "server engineer"),
        ("api 개발", "서버 개발", "분산 시스템", "결제 api", "백엔드 서비스"),
        ("spring", "spring boot", "django", "fastapi", "nestjs", "kafka", "redis"),
        ("java", "kotlin", "go", "python", "node.js", "postgresql", "mysql"),
        ("development", "operations", "automation"),
    ),
    DomainDefinition(
        "frontend",
        "프론트엔드",
        ("frontend", "front-end", "프론트엔드", "web frontend"),
        ("웹 화면", "사용자 인터페이스", "웹 프론트", "디자인 시스템", "브라우저"),
        ("react", "vue", "angular", "next.js", "svelte"),
        ("typescript", "javascript", "html", "css"),
        ("development",),
    ),
    DomainDefinition(
        "mobile",
        "모바일",
        ("mobile", "모바일", "android", "ios", "앱 개발"),
        ("모바일 앱", "안드로이드", "아이폰 앱", "앱 서비스"),
        ("swift", "swiftui", "kotlin", "flutter", "react native"),
        ("java", "typescript", "dart"),
        ("development",),
    ),
    DomainDefinition(
        "data",
        "데이터",
        ("data engineer", "data analyst", "analytics engineer", "데이터 엔지니어", "데이터 분석"),
        ("데이터 파이프라인", "데이터 웨어하우스", "etl", "지표 분석", "데이터 모델링"),
        ("airflow", "spark", "flink", "bigquery", "snowflake", "dbt"),
        ("sql", "python", "kafka", "pandas"),
        ("development", "analysis", "automation"),
    ),
    DomainDefinition(
        "ai",
        "AI",
        ("ai engineer", "machine learning", "ml engineer", "인공지능", "머신러닝", "llm engineer"),
        ("모델 학습", "모델 추론", "llm", "rag", "생성형 ai", "머신러닝 모델"),
        ("pytorch", "tensorflow", "hugging face", "vllm", "langchain"),
        ("python", "numpy", "pandas", "cuda"),
        ("development", "analysis"),
    ),
    DomainDefinition(
        "mlops",
        "MLOps",
        ("mlops", "machine learning platform", "ai platform", "머신러닝 플랫폼"),
        ("모델 배포", "학습 파이프라인", "모델 서빙", "모델 모니터링", "ai 인프라"),
        ("mlflow", "kubeflow", "vllm", "ray"),
        ("python", "kubernetes", "docker", "airflow", "prometheus"),
        ("development", "operations", "automation", "analysis"),
    ),
    DomainDefinition(
        "devops",
        "DevOps·플랫폼",
        ("devops", "sre", "platform engineer", "플랫폼 엔지니어", "site reliability"),
        ("배포 자동화", "ci/cd", "장애 대응", "플랫폼 운영", "관측성", "인프라 자동화"),
        ("kubernetes", "terraform", "ansible", "helm", "prometheus", "grafana"),
        ("docker", "linux", "aws", "gcp", "azure", "python", "go"),
        ("operations", "automation", "development"),
    ),
    DomainDefinition(
        "cloud",
        "클라우드",
        ("cloud engineer", "cloud architect", "클라우드 엔지니어", "클라우드 아키텍트"),
        ("클라우드 인프라", "클라우드 전환", "클라우드 아키텍처", "멀티 클라우드"),
        ("aws", "gcp", "azure", "terraform", "cloudformation"),
        ("kubernetes", "docker", "linux", "python", "go"),
        ("operations", "automation", "development", "planning"),
    ),
    DomainDefinition(
        "security",
        "보안",
        ("security engineer", "security analyst", "보안 엔지니어", "보안 분석", "information security"),
        ("침해 탐지", "보안 사고", "취약점", "보안 정책", "위협 분석", "보안 관제", "보안 자동화"),
        ("siem", "splunk", "wazuh", "burp suite", "nmap"),
        ("linux", "python", "aws", "kubernetes", "network"),
        ("operations", "analysis", "automation", "development"),
    ),
    DomainDefinition(
        "embedded",
        "임베디드",
        ("embedded", "firmware", "임베디드", "펌웨어"),
        ("펌웨어 개발", "디바이스 드라이버", "실시간 운영체제", "하드웨어 제어"),
        ("rtos", "embedded linux", "autosar", "can"),
        ("c", "c++", "linux", "cmake"),
        ("development", "operations"),
    ),
    DomainDefinition(
        "automotive",
        "자동차 소프트웨어",
        ("automotive", "vehicle software", "자동차 소프트웨어", "차량 소프트웨어"),
        ("차량 제어", "차량용", "전장", "adas", "인포테인먼트"),
        ("autosar", "can", "matlab", "simulink"),
        ("c", "c++", "python", "linux"),
        ("development", "analysis"),
    ),
    DomainDefinition(
        "robotics",
        "로보틱스",
        ("robotics", "robot engineer", "로봇", "로보틱스"),
        ("로봇 제어", "모션 플래닝", "slam", "센서 융합", "로봇 플랫폼"),
        ("ros", "ros2", "moveit", "gazebo"),
        ("c++", "python", "linux", "opencv"),
        ("development", "analysis", "operations"),
    ),
    DomainDefinition(
        "qa",
        "QA·테스트 자동화",
        ("qa engineer", "test engineer", "sdet", "품질 엔지니어", "테스트 엔지니어"),
        ("테스트 자동화", "품질 보증", "테스트 시나리오", "회귀 테스트"),
        ("selenium", "playwright", "cypress", "appium"),
        ("python", "javascript", "typescript", "pytest"),
        ("development", "automation", "analysis"),
    ),
    DomainDefinition(
        "product",
        "프로덕트",
        ("product manager", "product owner", "프로덕트 매니저", "서비스 기획"),
        ("제품 전략", "서비스 기획", "요구사항 정의", "제품 지표", "로드맵"),
        ("figma", "amplitude", "mixpanel"),
        ("sql", "jira"),
        ("planning", "analysis", "leadership"),
    ),
    DomainDefinition(
        "game",
        "게임 개발",
        ("game developer", "game programmer", "게임 개발", "게임 프로그래머"),
        ("게임 클라이언트", "게임 서버", "게임플레이", "게임 엔진"),
        ("unity", "unreal engine", "godot"),
        ("c#", "c++", "python"),
        ("development",),
    ),
)

DEFINITION_BY_ID = {definition.id: definition for definition in DOMAIN_DEFINITIONS}
KIND_RANK = {"direct": 0, "adjacent": 1, "interest": 2, "transition": 3}
GENERIC_WORDS = {
    "개발", "경험", "업무", "담당", "운영", "관리", "서비스", "시스템",
    "engineer", "developer", "development", "software", "기술", "지원",
}
WORK_TYPE_LABELS = {
    "development": "개발",
    "operations": "운영",
    "analysis": "분석",
    "automation": "자동화",
    "planning": "기획",
    "leadership": "리더십",
}
LOCATION_ALIASES = {
    "서울": "seoul",
    "seoul": "seoul",
    "경기": "gyeonggi",
    "성남": "gyeonggi",
    "분당": "gyeonggi",
    "판교": "gyeonggi",
    "수원": "gyeonggi",
    "gyeonggi": "gyeonggi",
    "인천": "incheon",
    "incheon": "incheon",
    "부산": "busan",
    "busan": "busan",
    "대전": "daejeon",
    "daejeon": "daejeon",
    "원격": "remote",
    "재택": "remote",
    "remote": "remote",
}


def _text(*values: Any) -> str:
    return " ".join(str(value) for value in values if value).strip().casefold()


def _skill_key(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).casefold()


def _unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def _matches(text: str, terms: tuple[str, ...]) -> list[str]:
    return [term for term in terms if term.casefold() in text]


def _posting_skills(posting: dict[str, Any]) -> list[str]:
    return _unique(
        list(posting.get("required_skills") or [])
        + list(posting.get("preferred_skills") or [])
        + list(posting.get("unspecified_skills") or [])
    )


def _skill_matches(skills: list[str], candidates: tuple[str, ...]) -> list[str]:
    keys = {_skill_key(value) for value in candidates}
    return [skill for skill in skills if _skill_key(skill) in keys]


def classify_posting(posting: dict[str, Any]) -> list[dict[str, Any]]:
    title = _text(posting.get("title"))
    body = _text(posting.get("description_excerpt"))
    skills = _posting_skills(posting)
    title_domains: list[dict[str, Any]] = []
    inferred_domains: list[dict[str, Any]] = []

    for definition in DOMAIN_DEFINITIONS:
        title_terms = _matches(title, definition.title_terms)
        responsibility_terms = _matches(body, definition.responsibility_terms)
        strong_skills = _skill_matches(skills, definition.strong_skills)
        supporting_skills = _skill_matches(skills, definition.supporting_skills)
        item = {
            "domain": definition.id,
            "label": definition.label,
            "title_terms": title_terms,
            "responsibility_terms": responsibility_terms,
            "strong_skills": strong_skills,
            "supporting_skills": supporting_skills,
            "explicit_role": bool(title_terms),
        }
        if title_terms:
            title_domains.append(item)
        elif responsibility_terms and (
            strong_skills or supporting_skills or len(responsibility_terms) >= 2
        ):
            inferred_domains.append(item)
        elif len(strong_skills) >= 2 or (strong_skills and supporting_skills):
            inferred_domains.append(item)

    candidates = title_domains or inferred_domains
    return sorted(
        candidates,
        key=lambda item: (
            -len(item["title_terms"]),
            -len(item["responsibility_terms"]),
            -len(item["strong_skills"]),
            -len(item["supporting_skills"]),
            item["label"],
        ),
    )


def _profile_domain(
    profile: dict[str, Any], owned_skills: list[str], definition: DomainDefinition
) -> dict[str, Any]:
    current_role_terms = _matches(_text(profile.get("current_role")), definition.title_terms)
    past_role_terms = _matches(_text(*(profile.get("past_roles") or [])), definition.title_terms)
    responsibility_terms = _matches(
        _text(profile.get("responsibilities"), profile.get("keep_experience")),
        definition.responsibility_terms,
    )
    highlights = profile.get("experience_highlights") or []
    highlight_text = _text(
        *[
            value
            for item in highlights
            for value in (
                item.get("title"),
                item.get("responsibilities"),
                item.get("outcome"),
            )
        ]
    )
    achievement_terms = _matches(highlight_text, definition.responsibility_terms)
    highlighted_domain = any(item.get("domain") == definition.id for item in highlights)
    highlight_skills = [skill for item in highlights for skill in item.get("skills", [])]
    skills = _unique(owned_skills + highlight_skills)
    strong_skills = _skill_matches(skills, definition.strong_skills)
    supporting_skills = _skill_matches(skills, definition.supporting_skills)
    matched_work_types = [
        value
        for value in (profile.get("work_types") or [])
        if value in definition.work_types
    ]
    skill_usage = profile.get("skill_usage") or {}
    recent_matched_skills = [
        skill
        for skill in _unique(strong_skills + supporting_skills)
        if (skill_usage.get(skill) or skill_usage.get(_skill_key(skill)) or {}).get("last_used")
        in {"current", "within_1y"}
    ]
    current_domain = profile.get("current_domain") == definition.id
    interested = definition.id in (profile.get("interest_domains") or [])

    if current_domain or current_role_terms:
        kind: DirectionKind = "direct"
    elif (
        past_role_terms
        or highlighted_domain
        or achievement_terms
        or len(responsibility_terms) >= 2
        or len(strong_skills) >= 2
        or (strong_skills and supporting_skills)
    ):
        kind = "adjacent"
    elif interested:
        kind = "interest"
    else:
        kind = "transition"

    reasons: list[str] = []
    evidence_types: list[str] = []
    if current_domain or current_role_terms:
        evidence_types.append("role")
        role = profile.get("current_role")
        reasons.append(
            f"{role} 직무 경험이 {definition.label} 공고의 역할과 겹칩니다."
            if role
            else f"현재 분야가 {definition.label}으로 입력되어 있습니다."
        )
    if past_role_terms:
        evidence_types.append("role")
        reasons.append(f"과거 직무 경험이 {definition.label} 역할과 겹칩니다.")
    if responsibility_terms:
        evidence_types.append("responsibility")
        reasons.append(
            f"{', '.join(responsibility_terms[:2])} 업무가 이 분야 공고에서 확인됩니다."
        )
    if highlighted_domain or achievement_terms:
        evidence_types.append("achievement")
        reasons.append(f"입력한 프로젝트·성과 경험이 {definition.label} 업무와 겹칩니다.")
    matched_skills = _unique(strong_skills + supporting_skills)
    if matched_skills:
        evidence_types.append("skill")
        if recent_matched_skills:
            evidence_types.append("recent_skill")
            reasons.append(
                f"최근 사용한 {', '.join(recent_matched_skills[:3])} 경험이 관련 공고에서 확인됩니다."
            )
        else:
            reasons.append(f"{', '.join(matched_skills[:3])} 사용 경험을 관련 공고와 비교했습니다.")
    if matched_work_types and evidence_types:
        evidence_types.append("work_type")
        labels = [WORK_TYPE_LABELS.get(value, value) for value in matched_work_types]
        reasons.append(f"{', '.join(labels[:3])} 업무 경험을 이 분야의 역할과 비교했습니다.")
    if interested and kind == "interest":
        evidence_types.append("interest")
        reasons.append(f"관심 분야로 선택한 {definition.label} 공고를 탐색 범위에 포함했습니다.")

    return {
        "domain": definition.id,
        "label": definition.label,
        "kind": kind,
        "reasons": _unique(reasons),
        "evidence_types": _unique(evidence_types),
        "responsibility_terms": responsibility_terms,
        "matched_skills": matched_skills,
        "recent_matched_skills": recent_matched_skills,
        "matched_work_types": matched_work_types,
    }


def _words(value: str) -> list[str]:
    return _unique(
        [
            word
            for word in re.split(r"[^\w+#.가-힣]+", value.casefold())
            if len(word) >= 2 and word not in GENERIC_WORDS
        ]
    )


def _common_words(profile: dict[str, Any], posting: dict[str, Any]) -> list[str]:
    highlights = profile.get("experience_highlights") or []
    profile_text = _text(
        profile.get("responsibilities"),
        *[
            value
            for item in highlights
            for value in (item.get("title"), item.get("responsibilities"), item.get("outcome"))
        ],
    )
    posting_words = set(_words(_text(posting.get("description_excerpt"))))
    return [word for word in _words(profile_text) if word in posting_words][:4]


def _career_condition(posting: dict[str, Any], profile: dict[str, Any]) -> str:
    years = profile.get("experience_years")
    career_level = profile.get("career_level") or ""
    posting_type = (posting.get("career_type") or "").casefold()
    if career_level == "new_comer" and posting_type == "experienced":
        return "changes"
    if career_level and career_level != "new_comer" and posting_type in {"new_comer", "newcomer"}:
        return "changes"
    if years is None:
        return "check"
    minimum = posting.get("career_min")
    maximum = posting.get("career_max")
    if posting_type in {"new_comer", "newcomer"} and years > 1:
        return "changes"
    if minimum is not None and years < minimum:
        return "changes"
    if maximum is not None and years > maximum:
        return "changes"
    return "continues"


def _employment_condition(posting: dict[str, Any], profile: dict[str, Any]) -> str:
    preferences = profile.get("employment_types") or []
    raw = _text(posting.get("employment_type"))
    if not preferences:
        return "check"
    if not raw:
        return "check"
    for preference in preferences:
        if preference == "full_time" and any(term in raw for term in ("full_time", "regular", "정규")):
            return "continues"
        if preference == "contract" and any(term in raw for term in ("contract", "계약")):
            return "continues"
        if preference == "freelance" and "freelanc" in raw:
            return "continues"
        if preference in raw:
            return "continues"
    return "changes"


def _location_keys(value: str) -> set[str]:
    normalized = _text(value)
    keys = {
        alias
        for token, alias in LOCATION_ALIASES.items()
        if token in normalized
    }
    if not keys and normalized:
        keys.add(re.sub(r"\s+", "", normalized))
    return keys


def _location_condition(posting: dict[str, Any], profile: dict[str, Any]) -> str:
    preferences = profile.get("preferred_locations") or []
    raw = str(posting.get("location") or "").strip()
    if not preferences or not raw:
        return "check"
    posting_keys = _location_keys(raw)
    preference_keys = set().union(*(_location_keys(value) for value in preferences))
    return "continues" if posting_keys & preference_keys else "changes"


def _connection(
    posting: dict[str, Any],
    profile: dict[str, Any],
    owned_skills: list[str],
    profile_domains: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    excluded = set(profile.get("excluded_domains") or [])
    posting_domains = [item for item in classify_posting(posting) if item["domain"] not in excluded]
    owned_keys = {_skill_key(value) for value in owned_skills}
    matched_skills = [skill for skill in _posting_skills(posting) if _skill_key(skill) in owned_keys]
    required = list(posting.get("required_skills") or [])
    matched_required = [skill for skill in required if _skill_key(skill) in owned_keys]
    unconfirmed_required = [skill for skill in required if _skill_key(skill) not in owned_keys]
    matched_responsibilities = _common_words(profile, posting)
    industries = [
        value
        for value in (profile.get("industry_experience") or [])
        if _text(value) in _text(posting.get("description_excerpt"))
    ][:3]
    career_condition = _career_condition(posting, profile)
    employment_condition = _employment_condition(posting, profile)
    location_condition = _location_condition(posting, profile)

    ranked: list[tuple[tuple[int, int, int, int, int], dict[str, Any], dict[str, Any]]] = []
    for posting_domain in posting_domains:
        evidence = profile_domains[posting_domain["domain"]]
        work_type_support = bool(
            evidence["matched_work_types"] and posting_domain["responsibility_terms"]
        )
        support_count = (
            bool(matched_skills)
            + bool(matched_responsibilities)
            + bool(industries)
            + bool(posting_domain["responsibility_terms"] and evidence["responsibility_terms"])
            + work_type_support
        )
        rank = (
            KIND_RANK[evidence["kind"]],
            -int(posting_domain["explicit_role"]),
            -support_count,
            -len([skill for skill in matched_skills if skill in evidence["recent_matched_skills"]]),
            -len(matched_required),
        )
        ranked.append((rank, posting_domain, evidence))
    ranked.sort(key=lambda value: value[0])
    best = ranked[0] if ranked else None

    if not best:
        reason = (
            f"{matched_skills[0]} 한 항목은 겹치지만 공고의 역할과 이어지는 근거는 확인되지 않았습니다."
            if len(matched_skills) == 1
            else "현재 프로필에서 공고의 역할과 이어지는 근거를 확인하지 못했습니다."
        )
        return {
            "direction_id": None,
            "direction_label": None,
            "direction_kind": None,
            "connection_level": "limited",
            "label": "추가 확인이 필요한 공고",
            "recommendation_eligible": False,
            "reasons": [reason],
            "evidence_types": ["skill"] if matched_skills else [],
            "matched_skills": matched_skills,
            "matched_responsibilities": matched_responsibilities,
            "unconfirmed_conditions": unconfirmed_required,
            "career_condition": career_condition,
            "employment_condition": employment_condition,
            "location_condition": location_condition,
        }

    _, posting_domain, evidence = best
    kind = evidence["kind"]
    has_role = bool(posting_domain["explicit_role"])
    has_specific_support = bool(
        matched_skills
        or matched_responsibilities
        or industries
        or (posting_domain["responsibility_terms"] and evidence["responsibility_terms"])
        or (posting_domain["responsibility_terms"] and evidence["matched_work_types"])
    )
    eligible = (
        kind != "transition"
        and has_role
        and has_specific_support
        and career_condition != "changes"
        and employment_condition != "changes"
    )
    evidence_types = list(evidence["evidence_types"])
    if matched_skills:
        evidence_types.append("skill")
    if matched_responsibilities:
        evidence_types.append("responsibility")
    if industries:
        evidence_types.append("industry")
    if posting_domain["responsibility_terms"] and evidence["matched_work_types"]:
        evidence_types.append("work_type")
    reasons = list(evidence["reasons"])
    if matched_responsibilities:
        reasons.insert(
            1 if reasons else 0,
            f"{', '.join(matched_responsibilities)} 표현이 공고의 주요 업무와 겹칩니다.",
        )
    if matched_skills:
        recent = [skill for skill in matched_skills if skill in evidence["recent_matched_skills"]]
        if recent:
            reasons.insert(
                1 if reasons else 0,
                f"최근 사용한 {', '.join(recent[:4])} 경험이 공고 조건과 겹칩니다.",
            )
        else:
            reasons.insert(
                1 if reasons else 0,
                f"{', '.join(matched_skills[:4])} 기술 경험이 공고 조건과 겹칩니다.",
            )
    if career_condition == "changes":
        reasons.insert(0, "입력한 경력 기간과 공고의 경력 조건이 다릅니다.")
    if employment_condition == "changes":
        reasons.insert(0, "희망 고용 형태와 공고의 고용 형태가 다릅니다.")
    if not has_role:
        reasons.insert(0, "공고 제목에서 해당 직무 역할을 명확히 확인하지 못했습니다.")
    if not has_specific_support:
        reasons.insert(0, "직무명 외에 업무나 기술이 겹치는 근거는 확인되지 않았습니다.")

    return {
        "direction_id": posting_domain["domain"],
        "direction_label": posting_domain["label"],
        "direction_kind": kind,
        "connection_level": kind if eligible else "limited",
        "label": {
            "direct": "현재 경력과 직접 이어짐",
            "adjacent": "경험을 활용할 수 있는 인접 분야",
            "interest": "관심 분야에서 확인한 공고",
            "transition": "전환 폭이 큰 방향",
        }[kind] if eligible else "조건을 더 확인할 공고",
        "recommendation_eligible": eligible,
        "reasons": _unique(reasons)[:3],
        "evidence_types": _unique(evidence_types),
        "matched_skills": matched_skills,
        "matched_responsibilities": matched_responsibilities,
        "unconfirmed_conditions": unconfirmed_required,
        "career_condition": career_condition,
        "employment_condition": employment_condition,
        "location_condition": location_condition,
        "matched_required_count": len(matched_required),
        "required_count": len(required),
    }


def _datetime_value(value: Any) -> float:
    if isinstance(value, datetime):
        return value.timestamp()
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
        except ValueError:
            return 0
    return 0


def _snapshot_id(profile: dict[str, Any], owned_skills: list[str], postings: list[dict[str, Any]]) -> str:
    payload = {
        "version": ANALYSIS_VERSION,
        "profile": profile,
        "owned_skills": sorted(owned_skills, key=str.casefold),
        "postings": sorted(
            [(str(item.get("id")), str(item.get("last_verified_at"))) for item in postings]
        ),
    }
    digest = hashlib.sha256(
        json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str).encode()
    ).hexdigest()[:12]
    return f"career-{digest}"


def analyze_career(
    *,
    profile: dict[str, Any],
    owned_skills: list[str],
    postings: list[dict[str, Any]],
    limit: int,
    offset: int,
    direction: str | None = None,
) -> dict[str, Any]:
    owned_skills = _unique([value.strip() for value in owned_skills if value.strip()])
    profile_skills = list((profile.get("skill_usage") or {}).keys())
    highlight_skills = [
        skill
        for item in (profile.get("experience_highlights") or [])
        for skill in item.get("skills", [])
    ]
    owned_skills = _unique(owned_skills + profile_skills + highlight_skills)
    profile_domains = {
        definition.id: _profile_domain(profile, owned_skills, definition)
        for definition in DOMAIN_DEFINITIONS
    }
    connections = {
        str(posting["id"]): _connection(posting, profile, owned_skills, profile_domains)
        for posting in postings
    }
    eligible = [
        posting
        for posting in postings
        if connections[str(posting["id"])]["recommendation_eligible"]
        and (not direction or connections[str(posting["id"])]["direction_id"] == direction)
    ]
    eligible.sort(
        key=lambda posting: (
            KIND_RANK[connections[str(posting["id"])]["direction_kind"]],
            connections[str(posting["id"])]["required_count"]
            - connections[str(posting["id"])]["matched_required_count"],
            connections[str(posting["id"])]["location_condition"] == "changes",
            -len(connections[str(posting["id"])]["evidence_types"]),
            -_datetime_value(posting.get("last_verified_at")),
            str(posting["id"]),
        )
    )

    domain_postings: dict[str, list[dict[str, Any]]] = {}
    for posting in postings:
        for classified in classify_posting(posting):
            domain = classified["domain"]
            if domain in set(profile.get("excluded_domains") or []):
                continue
            domain_postings.setdefault(domain, []).append(posting)

    directions: list[dict[str, Any]] = []
    for domain, field_postings in domain_postings.items():
        evidence = profile_domains[domain]
        if evidence["kind"] == "transition":
            continue
        representative = next(
            (
                posting
                for posting in eligible
                if connections[str(posting["id"])]["direction_id"] == domain
            ),
            None,
        )
        related_connections = [
            connections[str(posting["id"])]
            for posting in field_postings
            if connections[str(posting["id"])]["direction_id"] == domain
        ]
        companies = {
            posting.get("company_slug") or posting.get("company_name")
            for posting in field_postings
        }
        additional = _unique(
            [
                condition
                for connection in related_connections
                for condition in connection["unconfirmed_conditions"]
            ]
        )[:6]
        career_counts = {"new_comer": 0, "experienced": 0, "mixed_or_unknown": 0}
        representative_tasks: list[str] = []
        for posting in field_postings:
            posting_career = (posting.get("career_type") or "").casefold()
            if posting_career in {"new_comer", "newcomer"}:
                career_counts["new_comer"] += 1
            elif posting_career == "experienced":
                career_counts["experienced"] += 1
            else:
                career_counts["mixed_or_unknown"] += 1
            representative_tasks.extend(
                term
                for classified in classify_posting(posting)
                if classified["domain"] == domain
                for term in classified["responsibility_terms"]
            )
        directions.append(
            {
                "domain": domain,
                "label": DEFINITION_BY_ID[domain].label,
                "kind": evidence["kind"],
                "reasons": evidence["reasons"][:3],
                "evidence_types": evidence["evidence_types"],
                "matched_skills": evidence["matched_skills"],
                "posting_count": len(field_postings),
                "company_count": len(companies),
                "additional_conditions": additional,
                "career_counts": career_counts,
                "representative_tasks": _unique(representative_tasks)[:4],
                "representative_job": (
                    {
                        "id": str(representative["id"]),
                        "title": representative["title"],
                        "company_name": representative["company_name"],
                    }
                    if representative
                    else None
                ),
            }
        )
    directions.sort(
        key=lambda item: (
            KIND_RANK[item["kind"]],
            -len(item["evidence_types"]),
            -item["posting_count"],
            item["label"],
        )
    )

    recommendation_items = [
        {
            "posting": posting,
            "connection": connections[str(posting["id"])],
        }
        for posting in eligible[offset : offset + limit]
    ]
    calculated = max(
        (posting.get("last_verified_at") for posting in postings),
        key=_datetime_value,
        default=None,
    )
    return {
        "version": ANALYSIS_VERSION,
        "snapshot_id": _snapshot_id(profile, owned_skills, postings),
        "calculated_at": calculated,
        "analyzed_posting_count": len(postings),
        "analyzed_company_count": len(
            {
                posting.get("company_slug") or posting.get("company_name")
                for posting in postings
            }
        ),
        "directions": directions[:8],
        "recommendations": {
            "items": recommendation_items,
            "total": len(eligible),
            "limit": limit,
            "offset": offset,
        },
        "connections": connections,
        "profile_evidence_used": [
            field
            for field in (
                "current_role", "past_roles", "responsibilities", "experience_highlights",
                "work_types", "industry_experience", "experience_years", "skill_usage",
                "interest_domains", "excluded_domains", "preferred_locations",
                "employment_types", "career_level",
            )
            if profile.get(field)
        ],
        "profile_information_not_confirmed": [
            label
            for field, label in (
                ("current_role", "현재 직무"),
                ("responsibilities", "주요 업무 또는 프로젝트·성과 경험"),
                ("experience_years", "경력 기간"),
            )
            if profile.get(field) in (None, "", [])
        ],
    }


def build_market_fields(postings: list[dict[str, Any]]) -> dict[str, Any]:
    accumulators: dict[str, dict[str, Any]] = {}
    classified_posting_ids: set[str] = set()
    for posting in postings:
        classifications = classify_posting(posting)
        if classifications:
            classified_posting_ids.add(str(posting["id"]))
        for classified in classifications:
            domain = classified["domain"]
            field = accumulators.setdefault(
                domain,
                {
                    "posting_ids": set(),
                    "companies": set(),
                    "career_counts": {
                        "new_comer": 0,
                        "experienced": 0,
                        "mixed_or_unknown": 0,
                    },
                    "locations": {},
                    "skill_postings": {},
                    "skill_companies": {},
                    "jobs": [],
                },
            )
            posting_id = str(posting["id"])
            if posting_id in field["posting_ids"]:
                continue
            field["posting_ids"].add(posting_id)
            company = posting.get("company_slug") or posting.get("company_name")
            field["companies"].add(company)
            career = (posting.get("career_type") or "").casefold()
            if career in {"new_comer", "newcomer"}:
                field["career_counts"]["new_comer"] += 1
            elif career == "experienced":
                field["career_counts"]["experienced"] += 1
            else:
                field["career_counts"]["mixed_or_unknown"] += 1
            location = str(posting.get("location") or "").strip()
            if location:
                field["locations"][location] = field["locations"].get(location, 0) + 1
            for skill in _posting_skills(posting):
                field["skill_postings"][skill] = field["skill_postings"].get(skill, 0) + 1
                field["skill_companies"].setdefault(skill, set()).add(company)
            field["jobs"].append(posting)

    fields: list[dict[str, Any]] = []
    for domain, field in accumulators.items():
        posting_count = len(field["posting_ids"])
        company_count = len(field["companies"])
        locations = sorted(
            field["locations"].items(),
            key=lambda item: (-item[1], item[0]),
        )[:5]
        skills = sorted(
            field["skill_postings"],
            key=lambda skill: (
                -len(field["skill_companies"][skill]),
                -field["skill_postings"][skill],
                skill.casefold(),
            ),
        )[:8]
        jobs = sorted(
            field["jobs"],
            key=lambda posting: (
                -_datetime_value(posting.get("last_verified_at")),
                str(posting["id"]),
            ),
        )[:5]
        fields.append(
            {
                "domain": domain,
                "label": DEFINITION_BY_ID[domain].label,
                "posting_count": posting_count,
                "company_count": company_count,
                "career_counts": field["career_counts"],
                "top_locations": [
                    {"label": location, "posting_count": count}
                    for location, count in locations
                ],
                "top_skills": [
                    {
                        "skill": skill,
                        "posting_count": field["skill_postings"][skill],
                        "company_count": len(field["skill_companies"][skill]),
                    }
                    for skill in skills
                ],
                "jobs": jobs,
                "sample_status": "comparable"
                if posting_count >= 10 and company_count >= 3
                else "limited",
            }
        )
    fields.sort(key=lambda item: (-item["company_count"], -item["posting_count"], item["label"]))
    calculated = max(
        (posting.get("last_verified_at") for posting in postings),
        key=_datetime_value,
        default=None,
    )
    return {
        "version": ANALYSIS_VERSION,
        "calculated_at": calculated,
        "analyzed_posting_count": len(postings),
        "analyzed_company_count": len(
            {
                posting.get("company_slug") or posting.get("company_name")
                for posting in postings
            }
        ),
        "classified_posting_count": len(classified_posting_ids),
        "fields": fields,
    }
