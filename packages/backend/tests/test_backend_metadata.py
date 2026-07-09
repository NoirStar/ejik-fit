import tomllib
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


def test_backend_browser_extra_declares_playwright_runtime_dependency() -> None:
    pyproject = tomllib.loads(
        (
            REPOSITORY_ROOT / "packages" / "backend" / "pyproject.toml"
        ).read_text()
    )

    browser_deps = pyproject["project"]["optional-dependencies"]["browser"]

    assert any(
        dependency.startswith("playwright>=")
        for dependency in browser_deps
    )
