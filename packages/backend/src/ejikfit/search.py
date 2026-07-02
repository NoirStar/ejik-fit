import logging
from typing import Protocol

import meilisearch

from ejikfit.models import JobPosting


logger = logging.getLogger(__name__)
INDEX_NAME = "job_postings"


def posting_document(posting: JobPosting) -> dict[str, str | int | None]:
    return {
        "id": str(posting.id),
        "title": posting.title,
        "description_text": posting.description_text,
        "company_name": posting.company.name,
        "company_slug": posting.company.slug,
        "career_type": posting.career_type,
        "employment_type": posting.employment_type,
        "career_min": posting.career_min,
        "career_max": posting.career_max,
        "location": posting.location,
        "status": posting.status.value,
        "source_url": posting.url,
        "last_verified_at": posting.last_verified_at.isoformat(),
    }


class PostingIndex(Protocol):
    def upsert(self, posting: JobPosting) -> None: ...


class MeiliPostingIndex:
    def __init__(
        self,
        url: str,
        master_key: str,
        index_name: str = INDEX_NAME,
    ) -> None:
        self.client = meilisearch.Client(url, master_key)
        self.index = self.client.index(index_name)
        self._configured = False

    def configure(self) -> None:
        if self._configured:
            return
        self.index.update_searchable_attributes(
            ["title", "description_text", "company_name"]
        )
        self.index.update_filterable_attributes(
            [
                "company_slug",
                "career_type",
                "employment_type",
                "location",
                "status",
            ]
        )
        self.index.update_sortable_attributes(["last_verified_at"])
        self._configured = True

    def upsert(self, posting: JobPosting) -> None:
        self.configure()
        self.index.add_documents([posting_document(posting)])

    def search(
        self,
        query: str,
        *,
        company: str | None = None,
        career_type: str | None = None,
        limit: int = 20,
    ) -> list[dict]:
        filters = ['status = "open"']
        if company:
            filters.append(f'company_slug = "{company}"')
        if career_type:
            filters.append(f'career_type = "{career_type}"')

        result = self.index.search(
            query,
            {
                "filter": " AND ".join(filters),
                "limit": limit,
                "sort": ["last_verified_at:desc"],
            },
        )
        hits = result.get("hits", [])
        return [hit for hit in hits if isinstance(hit, dict)]
