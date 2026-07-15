from ejikfit.storage import S3SnapshotStore


def test_s3_store_passes_supabase_region(monkeypatch) -> None:
    captured: dict = {}

    def fake_client(service: str, **kwargs):
        assert service == "s3"
        captured.update(kwargs)
        return object()

    monkeypatch.setattr("ejikfit.storage.boto3.client", fake_client)

    S3SnapshotStore(
        endpoint_url="https://project.supabase.co/storage/v1/s3",
        region="ap-northeast-2",
        access_key="access",
        secret_key="secret",
        bucket="raw-snapshots",
    )

    assert captured["region_name"] == "ap-northeast-2"


def test_s3_store_uploads_identical_content_once_per_run(monkeypatch) -> None:
    uploads: list[dict] = []

    class FakeClient:
        def put_object(self, **kwargs) -> None:
            uploads.append(kwargs)

    monkeypatch.setattr(
        "ejikfit.storage.boto3.client",
        lambda *args, **kwargs: FakeClient(),
    )
    store = S3SnapshotStore(
        endpoint_url="https://project.supabase.co/storage/v1/s3",
        region="ap-northeast-2",
        access_key="access",
        secret_key="secret",
        bucket="raw-snapshots",
    )

    first = store.put(b"same listing", "application/json")
    second = store.put(b"same listing", "application/json")
    store.put(b"updated listing", "application/json")

    assert first == second
    assert len(uploads) == 2
