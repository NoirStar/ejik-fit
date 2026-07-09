import argparse
import json
import os
import uuid
from collections.abc import Sequence
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from ejikfit.db import SessionLocal
from ejikfit.models import CareerSource, PolicyStatus, SourceStatus
from ejikfit.seed_data import seed_sources


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="ejikfit")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser(
        "seed-sources",
        help="초기 공식 채용 출처를 데이터베이스에 등록합니다.",
    )
    list_parser = subparsers.add_parser(
        "list-sources",
        help="등록된 공식 채용 출처를 출력합니다.",
    )
    list_parser.add_argument(
        "--first-id",
        action="store_true",
        help="첫 출처 UUID만 출력합니다.",
    )
    crawl_parser = subparsers.add_parser(
        "crawl-source",
        help="출처 UUID 하나를 즉시 수집합니다.",
    )
    crawl_parser.add_argument("source_id")
    preview_parser = subparsers.add_parser(
        "preview-source",
        help="출처 UUID 하나를 저장 없이 fetch/parse 미리보기합니다.",
    )
    preview_parser.add_argument("source_id")
    status_parser = subparsers.add_parser(
        "set-source-status",
        help="출처 상태를 명시적으로 변경합니다.",
    )
    status_parser.add_argument("source_id")
    status_parser.add_argument(
        "status",
        choices=[status.value for status in SourceStatus],
    )
    status_parser.add_argument(
        "--policy-status",
        choices=[status.value for status in PolicyStatus],
        default=None,
    )
    subparsers.add_parser(
        "crawl-all",
        help="허용된 모든 공식 채용 출처를 수집합니다.",
    )
    subparsers.add_parser(
        "backfill-skills",
        help="저장된 모든 공고의 기술 스킬을 다시 추출합니다.",
    )
    return parser


def _sources(session) -> list[CareerSource]:
    statement = (
        select(CareerSource)
        .options(joinedload(CareerSource.company))
        .order_by(CareerSource.base_url)
    )
    return list(session.scalars(statement).unique().all())


def _source_status_payload(source: CareerSource) -> dict[str, str | None]:
    return {
        "source_id": str(source.id),
        "source_label": f"{source.company.name} / {source.source_type.value}",
        "status": source.status.value,
        "policy_status": source.policy_status.value,
        "last_error_code": source.last_error_code,
    }


def _set_source_status(
    session,
    source_id: str,
    status_value: str,
    policy_status_value: str | None,
) -> dict[str, str | None]:
    source = session.get(CareerSource, uuid.UUID(source_id))
    if source is None:
        raise ValueError(f"career source not found: {source_id}")

    source.status = SourceStatus(status_value)
    if policy_status_value is not None:
        source.policy_status = PolicyStatus(policy_status_value)
    elif source.status == SourceStatus.ALLOWED:
        source.policy_status = PolicyStatus.ALLOWED

    if source.status == SourceStatus.ALLOWED:
        source.last_error_code = None
        source.last_error_reason = None

    session.commit()
    return _source_status_payload(source)


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    if args.command == "seed-sources":
        with SessionLocal() as session:
            created = seed_sources(session)
            sources = _sources(session)
        print(f"created={created}")
        for source in sources:
            print(f"{source.id}\t{source.company.name}\t{source.base_url}")
        return 0

    if args.command == "list-sources":
        with SessionLocal() as session:
            sources = _sources(session)
        if args.first_id:
            if not sources:
                return 1
            print(sources[0].id)
            return 0
        for source in sources:
            print(f"{source.id}\t{source.company.name}\t{source.base_url}")
        return 0

    if args.command == "crawl-source":
        from ejikfit.crawler import run_source_by_id

        print(
            json.dumps(
                run_source_by_id(args.source_id),
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        return 0

    if args.command == "preview-source":
        from ejikfit.crawler import preview_source_by_id

        print(
            json.dumps(
                preview_source_by_id(args.source_id),
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        return 0

    if args.command == "set-source-status":
        with SessionLocal() as session:
            report = _set_source_status(
                session,
                args.source_id,
                args.status,
                args.policy_status,
            )
        print(json.dumps(report, ensure_ascii=False, sort_keys=True))
        return 0

    if args.command == "crawl-all":
        from ejikfit.crawler import render_crawl_summary, run_all_sources

        report = run_all_sources()
        print(
            json.dumps(
                report,
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary_path:
            with Path(summary_path).open("a", encoding="utf-8") as summary:
                summary.write(render_crawl_summary(report))
        return 1 if report["failed"] else 0

    if args.command == "backfill-skills":
        from ejikfit.skills import backfill_all_skills

        with SessionLocal() as session:
            count = backfill_all_skills(session)
        print(f"postings={count}")
        return 0

    raise AssertionError(f"처리되지 않은 명령: {args.command}")
