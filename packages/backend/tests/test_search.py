from ejikfit.search import MeiliPostingIndex


class FakeIndex:
    def __init__(self) -> None:
        self.options: dict | None = None

    def search(self, query: str, options: dict) -> dict:
        self.options = options
        return {"hits": []}


def test_search_filter_escapes_user_controlled_values() -> None:
    fake = FakeIndex()
    posting_index = object.__new__(MeiliPostingIndex)
    posting_index.index = fake

    posting_index.search(
        "backend",
        company='sample" OR status = "closed',
        career_type="new_comer",
    )

    assert fake.options is not None
    assert fake.options["filter"] == (
        'status = "open" AND '
        'company_slug = "sample\\" OR status = \\"closed" AND '
        'career_type = "new_comer"'
    )
