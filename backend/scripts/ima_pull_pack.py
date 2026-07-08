#!/usr/bin/env python3
"""从 IMA 雨桐知识库拉 PACK/电芯真值 → config/eval/ima_cell_tests.json。

不是'训练'(LLM 无梯度微调),而是把 IMA 里公司实测的电芯测试结局(型号/厂家/测试内容/OK-NG)
固化成真值表,喂给 PACK/sourcing 蜂群的真值锚与检查器——这才是让系统'越用越准'的正路。

走 ima_server OpenAPI:browse 低温电芯文件夹 → get_media_info 取签名URL → 下载 xlsx → 提取。
凭证读 ~/.config/ima/(client_id+api_key)。search 端点对本库返回0,故走 browse+download。

用法: python scripts/ima_pull_pack.py
"""

from __future__ import annotations

import io
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
OUT = ROOT / "config" / "eval" / "ima_cell_tests.json"
KB = "LQwD0jsCJ6DQQHd06ahTFxsNg_q0oBQ83fJDrSms7MU="  # 本司雨桐(自有)
CELL_FOLDER = "folder_7377223522742909"  # 本司-低温电芯


def _server():
    import mcp_servers.ima_server as m

    for v in vars(m).values():
        if isinstance(v, type) and hasattr(v, "browse_knowledge"):
            return v()
    raise SystemExit("未找到 IMAServer")


def _download(s, media_id: str) -> bytes | None:
    info = s.get_media_info(media_id=media_id)
    url = info.get("url")
    if not url:
        return None
    req = urllib.request.Request(url, headers=info.get("headers") or {})
    return urllib.request.urlopen(req, timeout=60).read()


def _extract_xlsx(data: bytes, src: str) -> list[dict]:
    import openpyxl

    wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows, hdr = [], None
    for row in ws.iter_rows(values_only=True):
        cells = [str(c).strip() if c is not None else "" for c in row]
        if hdr is None:
            if any("型号" in c for c in cells):
                hdr = cells
            continue
        if not any(cells):
            continue
        rec = dict(zip(hdr, cells))
        model = rec.get("产品型号", "") or next((v for k, v in rec.items() if "型号" in k), "")
        if not model:
            continue
        rows.append(
            {
                "model": model,
                "test": rec.get("测试内容", ""),
                "vendor": rec.get("厂家", ""),
                "result": rec.get("测试结果", ""),
                "note": rec.get("备注", ""),
                "src": src,
            }
        )
    return rows


def main() -> int:
    s = _server()
    r = s.browse_knowledge(knowledge_base_id=KB, folder_id=CELL_FOLDER, limit=30)
    xlsx = [
        it
        for it in r.get("items", [])
        if str(it.get("media_id", "")).startswith("excel") and "测试" in it.get("title", "")
    ]
    print(f"IMA 测试明细 xlsx: {len(xlsx)} 份")
    all_rows = []
    for it in xlsx:
        try:
            data = _download(s, it["media_id"])
            if not data:
                continue
            rows = _extract_xlsx(data, it["title"])
            all_rows.extend(rows)
            print(f"  {it['title']}: +{len(rows)}")
        except Exception as e:
            print(f"  {it['title']}: 失败 {type(e).__name__} {str(e)[:80]}")
    ng = sum(1 for x in all_rows if "NG" in x["result"] or "不" in x["result"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(all_rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"→ {OUT.relative_to(ROOT)}: {len(all_rows)} 条 (NG {ng}). 供 ima_grounding_check / cell_library 扩充用。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
