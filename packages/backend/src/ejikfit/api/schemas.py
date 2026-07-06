import uuid
from datetime import datetime

from pydantic import BaseModel


class PostingSummary(BaseModel):
    id: uuid.UUID
    title: str
    company_name: str
    career_type: str | None = None
    employment_type: str | None = None
    career_min: int | None = None
    career_max: int | None = None
    location: str | None = None
    status: str = "open"
    source_url: str
    last_verified_at: datetime


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


class SkillStat(BaseModel):
    skill: str
    category: str
    count: int
    required_count: int
    preferred_count: int
    unspecified_count: int


class SkillStatsResponse(BaseModel):
    items: list[SkillStat]
    total: int


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
