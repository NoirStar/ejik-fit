from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from ejikfit.config import Settings, get_settings


class Base(DeclarativeBase):
    pass


def engine_options(settings: Settings) -> dict:
    if settings.database_pool_mode == "transaction":
        return {
            "poolclass": NullPool,
            "connect_args": {"prepare_threshold": None},
        }
    return {"pool_pre_ping": True}


settings = get_settings()
engine = create_engine(settings.database_url, **engine_options(settings))
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_session() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session
