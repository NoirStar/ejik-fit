import json


def test_parse_line_gatsby_openings_maps_public_page_data() -> None:
    from ejikfit.connectors.line_gatsby import parse_line_gatsby_openings

    payload = {
        "result": {
            "data": {
                "allStrapiJobs": {
                    "edges": [
                        {
                            "node": {
                                "strapiId": 2100,
                                "title": "Server Engineer, Messaging Platform",
                                "publish": True,
                                "is_public": True,
                                "is_filters_public": True,
                                "employment_type": [{"name": "Full-time"}],
                                "job_unit": [{"name": "Engineering"}],
                                "job_fields": [{"name": "Backend"}],
                                "companies": [{"name": "LINE Plus"}],
                                "cities": [{"name": "Seoul"}],
                                "regions": [{"name": "Korea"}],
                                "start_date": "2026-07-01",
                                "end_date": "2026-08-01",
                                "until_filled": False,
                            }
                        },
                        {
                            "node": {
                                "strapiId": 2200,
                                "title": "Private",
                                "publish": False,
                                "is_public": False,
                                "is_filters_public": False,
                            }
                        },
                    ]
                }
            }
        }
    }

    openings = parse_line_gatsby_openings(
        json.dumps(payload, ensure_ascii=False),
        "https://careers.linecorp.com/page-data/jobs/page-data.json",
    )

    assert len(openings) == 1
    opening = openings[0]
    assert opening.external_id == "2100"
    assert opening.url == "https://careers.linecorp.com/ko/jobs/2100"
    assert opening.title == "Server Engineer, Messaging Platform"
    assert opening.status == "open"
    assert opening.employment_type == "Full-time"
    assert opening.location == "Seoul, Korea"
    assert opening.description_text == "Engineering Backend LINE Plus Seoul Korea"
    assert opening.opens_at is not None
    assert opening.closes_at is not None
