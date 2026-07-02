import argparse
from collections.abc import Sequence

from ejikfit.db import SessionLocal
from ejikfit.seed_data import seed_sources


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="ejikfit")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser(
        "seed-sources",
        help="초기 공식 채용 출처를 데이터베이스에 등록합니다.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    if args.command == "seed-sources":
        with SessionLocal() as session:
            created = seed_sources(session)
        print(f"created={created}")
        return 0

    raise AssertionError(f"처리되지 않은 명령: {args.command}")
