from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class OpeningRef:
    external_id: str
    url: str
    title: str | None = None


@dataclass(frozen=True)
class ParsedOpening:
    external_id: str
    url: str
    title: str
    status: str
    description_html: str
    description_text: str
    employment_type: str | None
    career_type: str | None
    career_min: int | None
    career_max: int | None
    location: str | None
    opens_at: datetime | None
    closes_at: datetime | None
