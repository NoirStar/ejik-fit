from fastapi import FastAPI

from ejikfit.api.fit import (
    DatabaseFitAnalysisReader,
    FitAnalysisReader,
    create_fit_router,
)
from ejikfit.api.graph import (
    DatabaseSkillGraphReader,
    SkillGraphReader,
    create_graph_router,
)
from ejikfit.api.postings import (
    DatabasePostingReader,
    PostingReader,
    create_postings_router,
)
from ejikfit.api.skills import (
    DatabaseSkillStatsReader,
    SkillTrendReader,
    SkillStatsReader,
    create_skills_router,
)
from ejikfit.api.sources import (
    DatabaseSourceDirectoryReader,
    DunamuJobsReader,
    SourceDirectoryReader,
    create_sources_router,
)
from ejikfit.config import Settings, get_settings
from ejikfit.search import MeiliPostingIndex
from ejikfit.skill_trends import DatabaseSkillTrendReader


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


def create_app(
    posting_reader: PostingReader | None = None,
    skill_stats_reader: SkillStatsReader | None = None,
    skill_trend_reader: SkillTrendReader | None = None,
    skill_graph_reader: SkillGraphReader | None = None,
    fit_analysis_reader: FitAnalysisReader | None = None,
    source_directory_reader: SourceDirectoryReader | None = None,
    dunamu_jobs_reader: DunamuJobsReader | None = None,
) -> FastAPI:
    application = FastAPI(title="이직핏 API", version="0.1.0")

    @application.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "ejik-fit-api"}

    if posting_reader is None:
        settings = get_settings()
        posting_reader = create_default_posting_reader(settings)
    application.include_router(create_postings_router(posting_reader))

    if skill_stats_reader is None:
        skill_stats_reader = DatabaseSkillStatsReader()
    if skill_trend_reader is None:
        skill_trend_reader = DatabaseSkillTrendReader()
    application.include_router(
        create_skills_router(skill_stats_reader, skill_trend_reader)
    )

    if skill_graph_reader is None:
        skill_graph_reader = DatabaseSkillGraphReader()
    application.include_router(create_graph_router(skill_graph_reader))

    if fit_analysis_reader is None:
        fit_analysis_reader = DatabaseFitAnalysisReader()
    application.include_router(create_fit_router(fit_analysis_reader))

    if source_directory_reader is None:
        source_directory_reader = DatabaseSourceDirectoryReader()
    application.include_router(
        create_sources_router(source_directory_reader, dunamu_jobs_reader)
    )

    return application


app = create_app()
