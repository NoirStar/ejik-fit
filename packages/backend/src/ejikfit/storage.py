import hashlib
from dataclasses import dataclass, field
from typing import Protocol

import boto3


class SnapshotStore(Protocol):
    def put(
        self,
        content: bytes,
        content_type: str,
    ) -> tuple[str, str]: ...


@dataclass
class MemorySnapshotStore:
    objects: dict[str, bytes] = field(default_factory=dict)

    def put(
        self,
        content: bytes,
        content_type: str,
    ) -> tuple[str, str]:
        digest = hashlib.sha256(content).hexdigest()
        key = f"sha256/{digest[:2]}/{digest}.html"
        self.objects.setdefault(key, content)
        return key, digest


class S3SnapshotStore:
    def __init__(
        self,
        endpoint_url: str,
        region: str,
        access_key: str,
        secret_key: str,
        bucket: str,
    ) -> None:
        self.bucket = bucket
        self.uploaded_keys: set[str] = set()
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
        )

    def put(
        self,
        content: bytes,
        content_type: str,
    ) -> tuple[str, str]:
        digest = hashlib.sha256(content).hexdigest()
        key = f"sha256/{digest[:2]}/{digest}.html"
        if key not in self.uploaded_keys:
            self.client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=content,
                ContentType=content_type,
            )
            self.uploaded_keys.add(key)
        return key, digest
