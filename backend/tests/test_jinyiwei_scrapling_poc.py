from harness.jinyiwei_scrapling_poc.scripts.run_scrapling_poc import (
    build_record,
    extract_title,
    normalize_text,
)


def test_extract_title_from_html():
    assert extract_title("<html><title> Example Title </title></html>") == "Example Title"


def test_normalize_text_collapses_whitespace():
    assert normalize_text("a\n\n b\t c") == "a b c"


def test_build_record_defaults_disable_stealth():
    record = build_record(
        "https://example.com",
        "fetched",
        "Example",
        "Body",
        {"robots_obeyed": True, "allowed": True},
    )

    assert record["source_url"] == "https://example.com"
    assert record["guardrails"]["stealth_enabled"] is False
    assert record["guardrails"]["cloudflare_solve_enabled"] is False
    assert record["confidence"] == "medium"
