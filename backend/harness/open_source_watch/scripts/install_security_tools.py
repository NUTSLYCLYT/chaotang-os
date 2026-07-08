from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import stat
import tarfile
import tempfile
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TOOLS_DIR = ROOT / "tools" / "bin"
DEFAULT_MANIFEST = ROOT / "tools" / "install_manifest.json"

RELEASE_API = {
    "osv-scanner": "https://api.github.com/repos/google/osv-scanner/releases/latest",
    "scorecard": "https://api.github.com/repos/ossf/scorecard/releases/latest",
}


@dataclass(frozen=True)
class InstalledTool:
    name: str
    version: str
    asset: str
    url: str
    digest: str | None
    path: str
    installed_at: str


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def fetch_json(url: str) -> dict[str, Any]:
    request = Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "jiqun-ai-security-tool-installer",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def download_bytes(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "jiqun-ai-security-tool-installer"})
    with urlopen(request, timeout=120) as response:
        return response.read()


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def expected_platform() -> tuple[str, str]:
    if os.uname().sysname.lower() != "linux":
        raise RuntimeError("Only linux is supported by this local installer.")
    machine = os.uname().machine.lower()
    if machine in {"x86_64", "amd64"}:
        return "linux", "amd64"
    if machine in {"aarch64", "arm64"}:
        return "linux", "arm64"
    raise RuntimeError(f"Unsupported machine architecture: {machine}")


def select_asset(tool_name: str, release: dict[str, Any], platform: str, arch: str) -> dict[str, Any]:
    assets = release.get("assets", [])
    if tool_name == "osv-scanner":
        expected = f"osv-scanner_{platform}_{arch}"
        for asset in assets:
            if asset.get("name") == expected:
                return asset
    if tool_name == "scorecard":
        prefix = f"scorecard_"
        suffix = f"_{platform}_{arch}.tar.gz"
        for asset in assets:
            name = str(asset.get("name", ""))
            if name.startswith(prefix) and name.endswith(suffix):
                return asset
    raise RuntimeError(f"No {platform}/{arch} asset found for {tool_name}.")


def verify_digest(data: bytes, digest: str | None) -> None:
    if not digest:
        return
    if not digest.startswith("sha256:"):
        raise RuntimeError(f"Unsupported digest format: {digest}")
    expected = digest.split(":", 1)[1]
    actual = sha256_hex(data)
    if actual != expected:
        raise RuntimeError(f"Digest mismatch: expected {expected}, got {actual}")


def install_raw_binary(data: bytes, destination: Path) -> None:
    destination.write_bytes(data)
    destination.chmod(destination.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def safe_extract_tar(data: bytes, member_name: str, destination: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        archive = Path(tmp) / "asset.tar.gz"
        archive.write_bytes(data)
        extract_dir = Path(tmp) / "extract"
        extract_dir.mkdir()
        with tarfile.open(archive, "r:gz") as tar:
            for member in tar.getmembers():
                target = extract_dir / member.name
                if not target.resolve().is_relative_to(extract_dir.resolve()):
                    raise RuntimeError(f"Unsafe tar member path: {member.name}")
            tar.extractall(extract_dir)
        matches = [path for path in extract_dir.rglob(member_name) if path.is_file()]
        if not matches:
            raise RuntimeError(f"{member_name} not found in archive")
        shutil.copy2(matches[0], destination)
        destination.chmod(destination.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def install_tool(tool_name: str, tools_dir: Path = DEFAULT_TOOLS_DIR) -> InstalledTool:
    platform, arch = expected_platform()
    release = fetch_json(RELEASE_API[tool_name])
    asset = select_asset(tool_name, release, platform, arch)
    data = download_bytes(asset["browser_download_url"])
    verify_digest(data, asset.get("digest"))
    tools_dir.mkdir(parents=True, exist_ok=True)
    destination = tools_dir / tool_name
    if tool_name == "osv-scanner":
        install_raw_binary(data, destination)
    elif tool_name == "scorecard":
        safe_extract_tar(data, "scorecard", destination)
    else:
        raise RuntimeError(f"Unknown tool: {tool_name}")
    return InstalledTool(
        name=tool_name,
        version=str(release.get("tag_name", "")),
        asset=str(asset.get("name", "")),
        url=str(asset.get("browser_download_url", "")),
        digest=asset.get("digest"),
        path=str(destination),
        installed_at=utc_now(),
    )


def write_manifest(installed: list[InstalledTool], manifest: Path = DEFAULT_MANIFEST) -> None:
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps([asdict(item) for item in installed], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Install local security POC tools into harness/open_source_watch/tools.")
    parser.add_argument("--tool", choices=sorted(RELEASE_API), action="append", help="Tool to install; repeatable")
    parser.add_argument("--tools-dir", type=Path, default=DEFAULT_TOOLS_DIR)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    tool_names = args.tool or sorted(RELEASE_API)
    installed = [install_tool(tool_name, args.tools_dir) for tool_name in tool_names]
    write_manifest(installed, args.manifest)
    for item in installed:
        print(f"installed {item.name} {item.version}: {item.path}")
    print(f"manifest: {args.manifest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
