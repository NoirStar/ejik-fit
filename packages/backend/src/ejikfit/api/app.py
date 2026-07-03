from fastapi import FastAPI

from ejikfit.api.postings import (
    DatabasePostingReader,
    PostingReader,
    create_postings_router,
)
from ejikfit.config import Settings, get_settings
from ejikfit.search import MeiliPostingIndex


def create_default_posting_reader(settings: Settings) -> DatabasePostingReader:
    search_index = None
    if settings.search_backend == "meilisearch":
        search_index = MeiliPostingIndex(
            settings.meili_url,
            settings.meili_master_key,
        )
    return DatabasePostingReader(
        search_index=search_index,
        use_pgroonga=settings.postgres_search_mode == "pgroonga",
    )


def create_app(posting_reader: PostingReader | None = None) -> FastAPI:
    application = FastAPI(title="이직핏 API", version="0.1.0")

    @application.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "ejik-fit-api"}

    if posting_reader is None:
        settings = get_settings()
        posting_reader = create_default_posting_reader(settings)
    application.include_router(create_postings_router(posting_reader))

    return application


app = create_app()
