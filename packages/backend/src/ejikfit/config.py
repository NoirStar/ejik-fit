from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ejikfit_env: str = "development"
    database_url: str = "postgresql+psycopg://ejikfit:ejikfit@localhost:5432/ejikfit"
    redis_url: str = "redis://localhost:6379/0"
    meili_url: str = "http://localhost:7700"
    meili_master_key: str = "local-development-key"
    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "ejikfit"
    s3_secret_key: str = "ejikfit-local-secret"
    s3_bucket: str = "raw-snapshots"
    crawler_user_agent: str = "EjikFitBot/0.1 (+https://github.com/NoirStar/ejik-fit)"


@lru_cache
def get_settings() -> Settings:
    return Settings()
