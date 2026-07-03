from sqlalchemy.pool import NullPool

from ejikfit.api.app import create_default_posting_reader
from ejikfit.config import Settings
from ejikfit.db import engine_options


def test_transaction_pooling_disables_client_pool_and_prepared_statements() -> None:
    settings = Settings(
        database_url="postgresql+psycopg://user:pass@pooler:6543/postgres",
        database_pool_mode="transaction",
    )

    options = engine_options(settings)

    assert options["poolclass"] is NullPool
    assert options["connect_args"] == {"prepare_threshold": None}


def test_local_database_keeps_pre_ping() -> None:
    settings = Settings(database_pool_mode="local")

    assert engine_options(settings) == {"pool_pre_ping": True}


def test_postgres_search_does_not_construct_meilisearch() -> None:
    settings = Settings(search_backend="postgres")

    reader = create_default_posting_reader(settings)

    assert reader.search_index is None
