import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class PostingSummary(BaseModel):
    id: uuid.UUID
    title: str
    company_name: str
    company_slug: str
    career_type: str | None = None
    employment_type: str | None = None
    career_min: int | None = None
    career_max: int | None = None
    location: str | None = None
    status: str = "open"
    source_url: str
    first_seen_at: datetime | None = None
    last_verified_at: datetime
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    required_skills: list[str] = []
    preferred_skills: list[str] = []
    unspecified_skills: list[str] = []


class SkillDetail(BaseModel):
    skill: str
    category: str
    requirement_type: str
    evidence_text: str | None = None
    confidence: float
    match_reason: str


class PostingDetail(PostingSummary):
    description_html: str
    description_text: str
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    skills: list[str] = []
    skill_details: list[SkillDetail] = []


class PostingListResponse(BaseModel):
    items: list[PostingSummary]
    total: int


class HiringCompanyActivity(BaseModel):
    company_name: str
    company_slug: str
    new_postings: int
    latest_first_seen_at: datetime
    nearest_deadline_at: datetime | None = None


class HiringOverviewResponse(BaseModel):
    range_start: date
    range_end: date
    activity_since: datetime
    deadline_total: int
    closing_next_7_days: int
    undated_open_postings: int
    activity_company_total: int
    deadlines: list[PostingSummary]
    activities: list[HiringCompanyActivity]


class SkillStat(BaseModel):
    skill: str
    category: str
    count: int
    company_count: int
    required_count: int
    preferred_count: int
    unspecified_count: int


class SkillStatsResponse(BaseModel):
    items: list[SkillStat]
    total: int


class SkillCatalogItem(BaseModel):
    name: str
    category: str
    kind: str
    domains: list[str]


class SkillCatalogResponse(BaseModel):
    items: list[SkillCatalogItem]
    total: int


class SkillTrendPoint(BaseModel):
    week_start: date
    count: int
    required_count: int
    preferred_count: int
    unspecified_count: int


class SkillTrendSeries(BaseModel):
    skill: str
    category: str
    points: list[SkillTrendPoint]


class SkillTrendResponse(BaseModel):
    status: Literal["collecting", "ready"]
    collected_weeks: int
    minimum_weeks: int
    latest_snapshot_at: datetime | None = None
    series: list[SkillTrendSeries]


class SourceDirectoryItem(BaseModel):
    company_name: str
    company_slug: str
    homepage_url: str | None = None
    careers_url: str
    collection_status: Literal["collecting", "preparing"]
    activity_status: Literal["active", "quiet", "attention", "preparing"]
    preparation_reason: Literal[
        "access_limited",
        "connector_pending",
        "policy_review",
    ] | None = None
    open_postings: int
    last_success_at: datetime | None = None


class SourceDirectoryResponse(BaseModel):
    items: list[SourceDirectoryItem]
    total: int
    collecting_count: int
    preparing_count: int
    open_postings: int


class SkillGraphNode(BaseModel):
    id: str
    label: str
    category: str
    kind: str
    domains: list[str]
    demand_count: int
    required_count: int
    preferred_count: int
    unspecified_count: int
    owned: bool = False
    seed: bool = False


class SkillGraphEdge(BaseModel):
    id: str
    source: str
    target: str
    score: float
    cooccurrence_count: int
    required_pair_count: int
    supporting_posting_ids: list[str]


class SkillGraphEvidence(BaseModel):
    posting_id: str
    title: str
    company_name: str
    skills: list[str]
    required: list[str]
    preferred: list[str]
    unspecified: list[str]


class SkillGraphMeta(BaseModel):
    limit: int
    min_confidence: float


class SkillGraphResponse(BaseModel):
    seed: str | None = None
    nodes: list[SkillGraphNode]
    edges: list[SkillGraphEdge]
    evidence: list[SkillGraphEvidence]
    meta: SkillGraphMeta


class SkillGraphEvidenceResponse(BaseModel):
    items: list[SkillGraphEvidence]
    total: int


class FitAnalyzeRequest(BaseModel):
    owned_skills: list[str]
    career_type: str | None = None
    domains: list[str] = []


class FitCoverageModel(BaseModel):
    matching_posting_count: int
    strong_fit_posting_count: int


class FitDomainBranchModel(BaseModel):
    domain: str
    covered_skills: list[str]
    missing_required_skills: list[str]
    missing_preferred_skills: list[str]
    supporting_posting_count: int


class FitRecommendedSkillModel(BaseModel):
    skill: str
    reason: str
    required_count: int
    preferred_count: int
    supporting_posting_count: int


class FitAnalyzeResponse(BaseModel):
    coverage: FitCoverageModel
    domain_branches: list[FitDomainBranchModel]
    recommended_next_skills: list[FitRecommendedSkillModel]
