import argparse
import asyncio
import json
import os
import uuid
from collections.abc import Sequence
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from ejikfit.db import SessionLocal
from ejikfit.models import CareerSource, Company, PolicyStatus, SourceStatus, SourceType
from ejikfit.seed_data import seed_sources


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="ejikfit")
    subparsers = parser.add_subparsers(dest="command", required=True)
    source_type_choices = [source_type.value for source_type in SourceType]
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
    crawl_parser.add_argument("source_id", nargs="?")
    crawl_parser.add_argument("--company-slug")
    crawl_parser.add_argument("--source-type", choices=source_type_choices)
    preview_parser = subparsers.add_parser(
        "preview-source",
        help="출처 UUID 하나를 저장 없이 fetch/parse 미리보기합니다.",
    )
    preview_parser.add_argument("source_id", nargs="?")
    preview_parser.add_argument("--company-slug")
    preview_parser.add_argument("--source-type", choices=source_type_choices)
    status_parser = subparsers.add_parser(
        "set-source-status",
        help="출처 상태를 명시적으로 변경합니다.",
    )
    status_parser.add_argument("source_id", nargs="?")
    status_parser.add_argument(
        "status",
        nargs="?",
        choices=[status.value for status in SourceStatus],
    )
    status_parser.add_argument(
        "--status",
        dest="status_option",
        choices=[status.value for status in SourceStatus],
        default=None,
    )
    status_parser.add_argument("--company-slug")
    status_parser.add_argument("--source-type", choices=source_type_choices)
    status_parser.add_argument(
        "--policy-status",
        choices=[status.value for status in PolicyStatus],
        default=None,
    )
    report_parser = subparsers.add_parser(
        "source-report",
        help="공식 출처 운영 상태 리포트를 출력합니다.",
    )
    report_parser.add_argument(
        "--format",
        choices=["json", "markdown"],
        default="json",
    )
    monitor_parser = subparsers.add_parser(
        "source-monitor",
        help="최근 출처 활동과 건강도 모니터를 출력합니다.",
    )
    monitor_parser.add_argument("--hours", type=int, default=24)
    monitor_parser.add_argument(
        "--format",
        choices=["json", "markdown"],
        default="json",
    )
    discovery_parser = subparsers.add_parser(
        "discover-sitemap",
        help="sitemap.xml 또는 robots.txt에서 공식 채용 URL 후보를 출력합니다.",
    )
    discovery_parser.add_argument("url")
    discovery_parser.add_argument("--sample-limit", type=int, default=20)
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


def _selected_source_id(
    source_id: str | None,
    company_slug: str | None,
    source_type_value: str | None,
) -> str:
    if company_slug is None:
        if source_type_value is not None:
            raise ValueError("--source-type requires --company-slug")
        if source_id is None:
            raise ValueError("source id or --company-slug is required")
        uuid.UUID(source_id)
        return source_id

    with SessionLocal() as session:
        return _resolve_source_id(
            session,
            source_id=source_id,
            company_slug=company_slug,
            source_type_value=source_type_value,
        )


def _resolve_source_id(
    session,
    *,
    source_id: str | None,
    company_slug: str | None,
    source_type_value: str | None,
) -> str:
    if source_id is not None:
        raise ValueError("provide either source id or --company-slug, not both")
    if company_slug is None:
        raise ValueError("source id or --company-slug is required")

    statement = (
        select(CareerSource)
        .join(CareerSource.company)
        .options(joinedload(CareerSource.company))
        .where(Company.slug == company_slug)
        .order_by(CareerSource.base_url)
    )
    if source_type_value is not None:
        statement = statement.where(
            CareerSource.source_type == SourceType(source_type_value)
        )

    sources = list(session.scalars(statement).unique().all())
    if not sources:
        selector = f"{company_slug}"
        if source_type_value is not None:
            selector = f"{selector} / {source_type_value}"
        raise ValueError(f"career source not found: {selector}")
    if len(sources) > 1:
        raise ValueError(
            f"multiple career sources found for company slug {company_slug!r}; "
            "pass --source-type"
        )
    return str(sources[0].id)


def _status_value(positional: str | None, option: str | None) -> str:
    if positional is not None and option is not None:
        raise ValueError("provide status either positionally or with --status")
    status_value = option or positional
    if status_value is None:
        raise ValueError("status is required")
    return status_value


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


def _discover_sitemap(url: str, sample_limit: int) -> dict:
    from ejikfit.config import get_settings
    from ejikfit.connectors.sitemap_discovery import parse_sitemap_discovery
    from ejikfit.crawler import HttpFetcher

    settings = get_settings()
    page = asyncio.run(HttpFetcher(settings.crawler_user_agent).fetch(url))
    candidates = parse_sitemap_discovery(page.text, page.url)
    return {
        "url": page.url,
        "discovered": len(candidates),
        "candidates": [
            candidate.to_dict() for candidate in candidates[:sample_limit]
        ],
    }


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

        source_id = _selected_source_id(
            args.source_id,
            args.company_slug,
            args.source_type,
        )
        print(
            json.dumps(
                run_source_by_id(source_id),
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        return 0

    if args.command == "preview-source":
        from ejikfit.crawler import preview_source_by_id

        source_id = _selected_source_id(
            args.source_id,
            args.company_slug,
            args.source_type,
        )
        print(
            json.dumps(
                preview_source_by_id(source_id),
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        return 0

    if args.command == "set-source-status":
        source_id = _selected_source_id(
            args.source_id,
            args.company_slug,
            args.source_type,
        )
        with SessionLocal() as session:
            report = _set_source_status(
                session,
                source_id,
                _status_value(args.status, args.status_option),
                args.policy_status,
            )
        print(json.dumps(report, ensure_ascii=False, sort_keys=True))
        return 0

    if args.command == "source-report":
        from ejikfit import source_report

        with SessionLocal() as session:
            report = source_report.build_source_report(session)
        if args.format == "markdown":
            print(source_report.render_source_report_markdown(report))
        else:
            print(json.dumps(report, ensure_ascii=False, sort_keys=True))
        return 0

    if args.command == "source-monitor":
        from ejikfit import source_monitor

        with SessionLocal() as session:
            report = source_monitor.build_source_monitor_report(
                session,
                window_hours=args.hours,
            )
        if args.format == "markdown":
            print(source_monitor.render_source_monitor_markdown(report))
        else:
            print(json.dumps(report, ensure_ascii=False, sort_keys=True))
        return 0

    if args.command == "discover-sitemap":
        print(
            json.dumps(
                _discover_sitemap(args.url, args.sample_limit),
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        return 0

    if args.command == "crawl-all":
        from ejikfit.crawler import render_crawl_summary, run_all_sources
        from ejikfit import source_report
        from ejikfit import source_monitor

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
                with SessionLocal() as session:
                    summary.write(
                        source_report.render_source_report_markdown(
                            source_report.build_source_report(session)
                        )
                    )
                    summary.write(
                        source_monitor.render_source_monitor_markdown(
                            source_monitor.build_source_monitor_report(session)
                        )
                    )
        return 1 if report["failed"] else 0

    if args.command == "backfill-skills":
        from ejikfit.skills import backfill_all_skills

        with SessionLocal() as session:
            count = backfill_all_skills(session)
        print(f"postings={count}")
        return 0

    raise AssertionError(f"처리되지 않은 명령: {args.command}")
