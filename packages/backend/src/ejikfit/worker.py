from celery import Celery

from ejikfit.config import get_settings


settings = get_settings()
celery_app = Celery(
    "ejikfit",
    broker=settings.redis_url,
    backend=settings.redis_url,
)
celery_app.conf.task_track_started = True
celery_app.conf.task_serializer = "json"


@celery_app.task(
    name="ejikfit.crawl_source",
    autoretry_for=(ConnectionError,),
    retry_backoff=True,
    max_retries=3,
)
def crawl_source_task(source_id: str) -> dict[str, int]:
    from ejikfit.crawler import run_source_by_id

    return run_source_by_id(source_id)
