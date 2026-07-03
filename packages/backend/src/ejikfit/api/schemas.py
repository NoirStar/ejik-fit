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


class PostingDetail(PostingSummary):
    description_html: str
    description_text: str
    opens_at: datetime | None = None
    closes_at: datetime | None = None


class PostingListResponse(BaseModel):
    items: list[PostingSummary]
    total: int
