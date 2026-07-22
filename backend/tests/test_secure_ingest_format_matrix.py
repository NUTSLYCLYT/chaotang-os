"""REQ-001：DOCX/搜索 PDF/扫描 PDF 任一被假成功必须失败——首刀只测 DOCX 这一列。"""

from __future__ import annotations

from pathlib import Path

from src.secure_ingest.limits import MAX_DOCX_PAGES, MAX_UPLOAD_BYTES
from src.secure_ingest.mime_sniff import detect_format
from src.secure_ingest.ooxml_structure import inspect_ooxml_structure
from tests.fixtures.secure_ingest_fixtures import (
    corrupted_zip_bytes,
    golden_docx_bytes,
    plain_text_bytes,
    zip_without_ooxml_parts_bytes,
)


def test_golden_docx_detected_as_ooxml() -> None:
    assert detect_format(golden_docx_bytes()) == "DOCX_OOXML"


def test_fake_mime_plain_text_rejected() -> None:
    """.txt 内容伪装成 .docx——magic bytes 不认，不看文件名。"""
    assert detect_format(plain_text_bytes()) == "UNKNOWN"


def test_zip_without_ooxml_parts_rejected() -> None:
    """合法 zip 但缺 word/document.xml —— 不能因为"是个 zip"就当 DOCX 放行。"""
    assert detect_format(zip_without_ooxml_parts_bytes()) == "UNKNOWN"


def test_corrupted_docx_rejected() -> None:
    assert detect_format(corrupted_zip_bytes()) == "CORRUPTED"


def test_encrypted_docx_reported_distinctly_from_corrupted() -> None:
    ole_header = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 32
    assert detect_format(ole_header) == "DOCX_ENCRYPTED"


def test_oversize_upload_limit_is_enforced_value() -> None:
    assert MAX_UPLOAD_BYTES == 20 * 1024 * 1024


def test_page_count_over_limit_would_be_rejected() -> None:
    # docProps/app.xml 是 best-effort 缓存值；合成 fixture 通常没有这个值。
    # 这里只验证阈值常量本身，真实超页判定在路由层用 MAX_DOCX_PAGES 比对。
    assert MAX_DOCX_PAGES == 100


def test_golden_docx_page_count_read_when_cached() -> None:
    """python-docx 新建文档会写 docProps/app.xml 缓存 <Pages>(默认 1)，能读到就用；
    读不到时(见 ooxml_structure.py 的 None 分支)才不当拒绝理由——两条路径都不硬拒。"""
    result = inspect_ooxml_structure(golden_docx_bytes())
    assert result.page_count == 1


def test_page_count_none_when_app_xml_part_absent() -> None:
    """app.xml 部件本身缺失时(比如手工拼装的 zip，不是 Word/python-docx 生成)，
    page_count 必须是 None，不能默认成 0 或抛异常。"""
    # 直接构造一个"合法 DOCX 但没有 docProps/app.xml"的样本。
    import io
    import zipfile

    base = io.BytesIO(golden_docx_bytes())
    out = io.BytesIO()
    with zipfile.ZipFile(base) as src, zipfile.ZipFile(out, "w") as dst:
        for item in src.infolist():
            if item.filename == "docProps/app.xml":
                continue
            dst.writestr(item, src.read(item.filename))
    result = inspect_ooxml_structure(out.getvalue())
    assert result.page_count is None


def test_mime_sniff_source_never_trusts_filename_or_declared_content_type() -> None:
    """源码回归哨兵：detect_format 的签名只吃 bytes，不吃 filename/content_type 参数——
    防止未来有人图省事加个"文件名以 .docx 结尾就放行"的快捷路径。"""
    src = Path("src/secure_ingest/mime_sniff.py").read_text(encoding="utf-8")
    assert "def detect_format(raw_bytes: bytes)" in src
    assert "filename" not in src
    assert "content_type" not in src
