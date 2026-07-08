#!/usr/bin/env python3
"""IMA 自有知识库 → 本地文件下载(只下载,不入库,避免与其他写库进程抢 chroma 锁)。

走 ima_server OpenAPI:递归 browse_knowledge 收集文件项 → get_media_info 取签名URL+headers
→ 下载到本地文件夹。下载完用 local_ingest.py / ocr_ingest.py 灌库。
订阅/共享库会被 220030 拒(只列不下);自有库(如"雨桐")放行。

用法:
  python scripts/ima_download.py --kb 雨桐 --out /tmp/ima_yutong --max 25
"""

from __future__ import annotations

import argparse
import inspect
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

EXT_BY_PREFIX = {"word": ".doc", "pdf": ".pdf", "excel": ".xlsx", "ppt": ".pptx", "txt": ".txt"}


def _server():
    import mcp_servers.ima_server as m

    for _, obj in vars(m).items():
        if inspect.isclass(obj) and hasattr(obj, "browse_knowledge"):
            return obj()
    raise RuntimeError("找不到 IMAServer")


def collect_files(srv, kb_id: str, limit: int, folder: str = "", depth: int = 0, acc=None):
    """递归收集非文件夹文件项(广度有限,防爆)。"""
    acc = acc if acc is not None else []
    if len(acc) >= limit or depth > 3:
        return acc
    res = srv.browse_knowledge(knowledge_base_id=kb_id, folder_id=folder, limit=50)
    for it in res.get("items") or []:
        mid = str(it.get("media_id", ""))
        if mid.startswith("folder_"):
            collect_files(srv, kb_id, limit, folder=mid, depth=depth + 1, acc=acc)
        elif mid:
            acc.append(it)
        if len(acc) >= limit:
            break
    return acc


def main() -> int:
    ap = argparse.ArgumentParser(description="IMA 自有库 → 本地下载")
    ap.add_argument("--kb", required=True, help="知识库名关键词(如 雨桐)")
    ap.add_argument("--out", default="/tmp/ima_dl")
    ap.add_argument("--max", type=int, default=25)
    args = ap.parse_args()

    srv = _server()
    kbs = srv.list_knowledge_bases().get("knowledge_bases", [])
    match = [k for k in kbs if args.kb in k.get("name", "")]
    if not match:
        print(f"❌ 没找到含「{args.kb}」的知识库。现有:", [k.get("name") for k in kbs])
        return 1
    kb = match[0]
    print(f"库: {kb['name']} (docs={kb.get('content_count')})")

    files = collect_files(srv, kb["id"], args.max)
    print(f"递归收集到 {len(files)} 个文件项(上限 {args.max})")

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    ok = denied = err = 0
    for i, f in enumerate(files):
        mid = f["media_id"]
        title = (f.get("title") or mid)[:60].replace("/", "_")
        try:
            info = srv.get_media_info(mid)
            if isinstance(info, dict) and info.get("error"):
                denied += 1
                print(f"  ⛔ [{i + 1}] {title}: {info.get('error')[:30]} (retcode={info.get('retcode')})")
                continue
            url = info.get("url") or info.get("download_url")
            headers = info.get("headers") or {}
            if not url:
                err += 1
                continue
            ext = EXT_BY_PREFIX.get(mid.split("_")[0], "")
            dest = out / (f"{i:03d}_{title}{ext}")
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=60) as r, dest.open("wb") as w:
                w.write(r.read())
            ok += 1
            print(f"  ✅ [{i + 1}] {dest.name} ({dest.stat().st_size} bytes)", flush=True)
        except Exception as e:
            err += 1
            print(f"  ❌ [{i + 1}] {title}: {type(e).__name__}: {str(e)[:50]}", flush=True)

    print(f"\n下载完成: 成功 {ok} / 被拒 {denied} / 错 {err} → {out}")
    print(f"下一步灌库: python scripts/local_ingest.py --dir {out} --domain 雨桐库")
    return 0


if __name__ == "__main__":
    sys.exit(main())
