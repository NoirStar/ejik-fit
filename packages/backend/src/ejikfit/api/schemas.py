import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


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
    skill_categories: list[str] = []
    description_excerpt: str | None = Field(default=None, max_length=1200)


class SkillDetail(BaseModel):
    skill: str
    category: str
    requirement_type: str
    evidence_text: str | None = None
    confidence: float
    match_reason: str


class PostingDescriptionImage(BaseModel):
    url: str
    alt: str


class PostingDetail(PostingSummary):
    description_html: str
    description_text: str
    description_images: list[PostingDescriptionImage] = Field(default_factory=list)
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    skills: list[str] = []
    skill_details: list[SkillDetail] = []


class PostingListResponse(BaseModel):
    items: list[PostingSummary]
    total: int
    canonical_owned_skills: list[str] = Field(default_factory=list)


class CareerSkillUsageInput(BaseModel):
    years: float | None = Field(default=None, ge=0, le=80)
    last_used: str | None = Field(default=None, max_length=40)


class CareerExperienceInput(BaseModel):
    title: str = Field(default="", max_length=200)
    responsibilities: str = Field(default="", max_length=4_000)
    outcome: str = Field(default="", max_length=2_000)
    domain: str = Field(default="", max_length=80)
    skills: list[str] = Field(default_factory=list, max_length=50)


class CareerProfileInput(BaseModel):
    current_role: str = Field(default="", max_length=200)
    past_roles: list[str] = Field(default_factory=list, max_length=20)
    experience_years: float | None = Field(default=None, ge=0, le=80)
    responsibilities: str = Field(default="", max_length=6_000)
    keep_experience: str = Field(default="", max_length=2_000)
    experience_highlights: list[CareerExperienceInput] = Field(
        default_factory=list,
        max_length=30,
    )
    work_types: list[str] = Field(default_factory=list, max_length=20)
    industry_experience: list[str] = Field(default_factory=list, max_length=30)
    current_domain: str = Field(default="", max_length=80)
    interest_domains: list[str] = Field(default_factory=list, max_length=30)
    excluded_domains: list[str] = Field(default_factory=list, max_length=30)
    preferred_locations: list[str] = Field(default_factory=list, max_length=30)
    employment_types: list[str] = Field(default_factory=list, max_length=20)
    career_level: str = Field(default="", max_length=40)
    skill_usage: dict[str, CareerSkillUsageInput] = Field(default_factory=dict)


class CareerAnalyzeRequest(BaseModel):
    profile: CareerProfileInput = Field(default_factory=CareerProfileInput)
    owned_skills: list[str] = Field(default_factory=list, max_length=100)
    direction: str | None = Field(default=None, max_length=80)
    q: str | None = Field(default=None, max_length=200)
    career_type: str | None = Field(default=None, max_length=100)
    category: str | None = Field(default=None, max_length=64)
    connection_ids: list[str] = Field(default_factory=list, max_length=100)
    limit: int = Field(default=12, ge=1, le=100)
    offset: int = Field(default=0, ge=0, le=100_000)


class CareerJobConnection(BaseModel):
    direction_id: str | None = None
    direction_label: str | None = None
    direction_kind: Literal["direct", "adjacent", "interest", "transition"] | None = None
    connection_level: Literal["direct", "adjacent", "interest", "limited"]
    label: str
    recommendation_eligible: bool
    reasons: list[str] = Field(default_factory=list)
    evidence_types: list[str] = Field(default_factory=list)
    matched_skills: list[str] = Field(default_factory=list)
    matched_responsibilities: list[str] = Field(default_factory=list)
    unconfirmed_conditions: list[str] = Field(default_factory=list)
    career_condition: Literal["continues", "check", "changes"]
    employment_condition: Literal["continues", "check", "changes"]
    location_condition: Literal["continues", "check", "changes"]


class CareerRepresentativeJob(BaseModel):
    id: str
    title: str
    company_name: str


class CareerDirection(BaseModel):
    domain: str
    label: str
    kind: Literal["direct", "adjacent", "interest", "transition"]
    reasons: list[str] = Field(default_factory=list)
    evidence_types: list[str] = Field(default_factory=list)
    matched_skills: list[str] = Field(default_factory=list)
    posting_count: int
    company_count: int
    additional_conditions: list[str] = Field(default_factory=list)
    career_counts: dict[Literal["new_comer", "experienced", "mixed_or_unknown"], int]
    representative_tasks: list[str] = Field(default_factory=list)
    representative_job: CareerRepresentativeJob | None = None


class CareerRecommendationItem(BaseModel):
    posting: PostingSummary
    connection: CareerJobConnection


class CareerRecommendationPage(BaseModel):
    items: list[CareerRecommendationItem]
    total: int
    limit: int
    offset: int


class CareerAnalyzeResponse(BaseModel):
    version: str
    snapshot_id: str
    calculated_at: datetime | None = None
    analyzed_posting_count: int
    analyzed_company_count: int
    directions: list[CareerDirection]
    recommendations: CareerRecommendationPage
    connections: dict[str, CareerJobConnection]
    profile_evidence_used: list[str] = Field(default_factory=list)
    profile_information_not_confirmed: list[str] = Field(default_factory=list)


class MarketFieldLocation(BaseModel):
    label: str
    posting_count: int


class MarketFieldSkill(BaseModel):
    skill: str
    posting_count: int
    company_count: int


class MarketCareerField(BaseModel):
    domain: str
    label: str
    posting_count: int
    company_count: int
    career_counts: dict[Literal["new_comer", "experienced", "mixed_or_unknown"], int]
    top_locations: list[MarketFieldLocation]
    top_skills: list[MarketFieldSkill]
    jobs: list[PostingSummary]
    sample_status: Literal["comparable", "limited"]


class MarketCareerFieldsResponse(BaseModel):
    version: str
    calculated_at: datetime | None = None
    analyzed_posting_count: int
    analyzed_company_count: int
    classified_posting_count: int
    fields: list[MarketCareerField]


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
    aliases: list[str] = Field(default_factory=list)


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
