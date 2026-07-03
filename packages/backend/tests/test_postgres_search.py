from sqlalchemy.dialects import postgresql

from ejikfit.api.postings import _posting_search_clause


def _compiled_sql(query: str, use_pgroonga: bool) -> str:
    return str(
        _posting_search_clause(query, use_pgroonga=use_pgroonga).compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )


def test_pgroonga_search_uses_multilingual_operator() -> None:
    sql = _compiled_sql("보안 엔지니어", use_pgroonga=True)

    assert "&@~" in sql
    assert "job_postings.title" in sql
    assert "job_postings.description_text" in sql
    assert "job_postings.location" in sql


def test_local_search_uses_case_insensitive_substring() -> None:
    sql = _compiled_sql("backend", use_pgroonga=False)

    assert "ILIKE" in sql
    assert "%backend%" in sql
