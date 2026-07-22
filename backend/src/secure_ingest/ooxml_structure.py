"""REQ-002：宏/zip-bomb 结构性检查 + best-effort 页数读取。

**边界(硬红线,不得被后续改动悄悄抹掉)**：这里做的是 OOXML 容器结构检查(宏部件是否存在、
压缩比/成员数是否异常)，**不是**病毒扫描。真正的病毒特征库检测(ClamAV 级别)需要一个
真实 AV 引擎依赖，明确排除在 R0 范围外——R0 只处理合成数据，没有真实用户上传恶意文件的
风险，且本仓库对高 CVE 风险依赖一贯谨慎(见 requirements.txt 里 chromadb 因未修 CVE 干脆
不装的先例)。真 AV 引擎集成是明确记录的后续工作，不是被静默忽略的缺口。
"""

from __future__ import annotations

import io
import re
import zipfile

from src.secure_ingest.limits import (
    MAX_ZIP_COMPRESSION_RATIO,
    MAX_ZIP_MEMBER_COUNT,
    MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES,
)

_MACRO_PART = "word/vbaProject.bin"
_MACRO_CONTENT_TYPE = "macroEnabled"
_APP_XML_PART = "docProps/app.xml"
# 不可信输入不上完整 XML parser(XXE/billion-laughs 攻击面) —— 这个值就是一个整数，
# 用锚定标签的正则直接抠出来，正则没有实体展开能力，天然不存在这类攻击面。
_PAGES_TAG_RE = re.compile(rb"<Pages>(\d+)</Pages>")


class OoxmlStructureResult:
    __slots__ = ("macro_detected", "zip_bomb_suspected", "page_count")

    def __init__(self, *, macro_detected: bool, zip_bomb_suspected: bool, page_count: int | None) -> None:
        self.macro_detected = macro_detected
        self.zip_bomb_suspected = zip_bomb_suspected
        self.page_count = page_count


def inspect_ooxml_structure(raw_bytes: bytes) -> OoxmlStructureResult:
    """假定调用方已经用 `mime_sniff.detect_format` 确认这是 `DOCX_OOXML`。"""
    with zipfile.ZipFile(io.BytesIO(raw_bytes)) as zf:
        infos = zf.infolist()
        names = {info.filename for info in infos}

        macro_detected = _MACRO_PART in names
        if not macro_detected:
            try:
                content_types = zf.read("[Content_Types].xml").decode("utf-8", errors="ignore")
                macro_detected = _MACRO_CONTENT_TYPE in content_types
            except KeyError:
                pass

        zip_bomb_suspected = len(infos) > MAX_ZIP_MEMBER_COUNT
        total_uncompressed = 0
        for info in infos:
            total_uncompressed += info.file_size
            ratio = info.file_size / max(info.compress_size, 1)
            if ratio > MAX_ZIP_COMPRESSION_RATIO:
                zip_bomb_suspected = True
        if total_uncompressed > MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES:
            zip_bomb_suspected = True

        page_count = _read_cached_page_count(zf, names)

    return OoxmlStructureResult(
        macro_detected=macro_detected,
        zip_bomb_suspected=zip_bomb_suspected,
        page_count=page_count,
    )


def _read_cached_page_count(zf: zipfile.ZipFile, names: set[str]) -> int | None:
    """`docProps/app.xml` 的 `<Pages>` 是 Word 上次保存时缓存的估计值，不是权威真值——
    合成 fixture(从未被 Word 打开过)通常没有这个值，读不到就返回 None，不当作拒绝理由。

    正则提取而非完整 XML 解析：这是解析不可信上传文件内容，标准库 XML parser 默认不防
    XXE/billion-laughs，没必要为了一个整数字段承担那个攻击面。
    """
    if _APP_XML_PART not in names:
        return None
    try:
        raw = zf.read(_APP_XML_PART)
    except KeyError:
        return None
    match = _PAGES_TAG_RE.search(raw)
    if match is None:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None
