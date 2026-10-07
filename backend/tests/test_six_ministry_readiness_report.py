from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import jsonschema
import pytest

from app.agents.runtime_skills.family_runtime import load_capability_family_bindings
from app.agents.runtime_skills.registry import build_default_downstream_skill_registry

_ROOT = Path(__file__).resolve().parents[2]
_REPORT = _ROOT / "docs/migrations/2026-08-14-six-ministry-runtime-readiness.json"
_MATRIX = _ROOT / "docs/migrations/2026-08-14-six-ministry-capability-family-matrix.json"
_SCHEMA = _ROOT / "docs/contracts/six-ministry-runtime-readiness.schema.json"
_HARNESS = _ROOT / "scripts/check_harness.mjs"
_HISTORICAL_REVIEWED_FINGERPRINT = (
    "sha256:a6c2de2ca7f15069a6d997ce2cccb9498ddd4dd1269d539c192993e85a265190"
)
_CURRENT_CONTENT_EXCLUSIONS = (
    "backend/app/accounting_reports/storage.py",
    "backend/tests/test_six_ministry_accounting_evidence_adapter.py",
    "backend/tests/test_six_ministry_readiness_report.py",
    "scripts/check_harness.mjs",
)
_SUCCESSOR_CONTENT_PATHS = (
    "backend/app/accounting_reports/storage.py",
    "backend/tests/test_six_ministry_accounting_evidence_adapter.py",
)
_CONTENT_FINGERPRINT_PAIRS = (
    (
        "sha256:013bfb8272e936be85c2d470033787c3b7f105ad6eae2dfe680373df023b5e69",
        "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
    ),
    (
        "sha256:c95630be3d79f2641ff6e483f4096b0763b9e5071544f1e0ead0d7e24eb1cba5",
        "sha256:268cab13e516d0f716f600819f2bddc8242269312d392eca4ed1be2de05ce051",
    ),
    (
        "sha256:d330b7f177f5bbb761eb359ffffca6f12250e5bbe90d13d0414d0fdefb78e98a",
        "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
    ),
    (
        "sha256:da31e8098bf76c72ff8d00b073d86e3442b0811223ef3e3bab770af31e89c28e",
        "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
    ),
    (
        "sha256:a6d109de75e877620a89241a4dcabcc716e1a5a1a18a024c9a3cb73e578de80c",
        "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
    ),
    (
        "sha256:cc42339eaa423d71307ef96ff713ec095a89ba2cc4d4f6630ee1b40dec94d34d",
        "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
    ),
    (
        "sha256:eb0d8d214c2dc51ca4eb37ce5a13423e424fd6fdd3b6b8c3dac6a5f5757bd2df",
        "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
    ),
    (
        "sha256:82885fc13cec86318e4436fccfd80c78d7880e4aa25cdb530d0f4d18c9c73fe3",
        "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
    ),
    (
        "sha256:598dd8e735ce98b2d8a5307c3fa8b866d8fe72521c92b0c6ea4ba360d7bc9f79",
        "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
    ),
    (
        "sha256:32ecf613778ddc625567b08ec4526efbf22c0cd29a8c94fc3b9bacbe4e0dd05e",
        "sha256:9d10d2bed258e632c909719f05df50c6b33530d9f40be2458a38dd063fcde3c5",
    ),
    (
        "sha256:32ecf613778ddc625567b08ec4526efbf22c0cd29a8c94fc3b9bacbe4e0dd05e",
        "sha256:1922b611550d73daa6226d9dd8abf8d9f9691a0501f9f1fd0ea83e8c772829d2",
    ),
    (
        "sha256:598dd8e735ce98b2d8a5307c3fa8b866d8fe72521c92b0c6ea4ba360d7bc9f79",
        "sha256:43cf0adb1d4312e17fef0ec33ca963dbbc98b30d92d9f558a901f0d3ec0a9fea",
    ),
    (
        "sha256:598dd8e735ce98b2d8a5307c3fa8b866d8fe72521c92b0c6ea4ba360d7bc9f79",
        "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2",
    ),
    (
        "sha256:9e8729a88bc797c01d59818fb67d852025a9c679fdd7eb6e8fe63f26cbc8d365",
        "sha256:6b9521165b821729a3548f3535b90c30aab9b874c81b1b1b437bb5af64d06e34",
    ),
    (
        "sha256:33baa33eebcbefbb09f85fb09b4f49baf145b667eabdfe2be3c245f43f39f2f7",
        "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2",
    ),
    (
        "sha256:7a1220fa7c583de7248eca3ef6deac9b50635f73bf08d569190a3505b62db628",
        "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2",
    ),
    (
        "sha256:da31d9d44a2d9fc81e562d0f59027b5a7114afacbdd9f6803b5511350d9c9666",
        "sha256:8c4e1669489eb5ec90a79e8e123a390a6e5b74fcc369adcd249493c5ba7c326e",
    ),
    (
        "sha256:9b9927bb53cccc26e074c1f382630d94445d0b207cddfa88930dcfc3f7b705a0",
        "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2",
    ),
    (
        "sha256:c711c32fea39b31177e49f836455102a25fc4b9662363075b24fc25efb73991f",
        "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2",
    ),
    (
        "sha256:9a78e2b67840d116179d755fd3d9949643d7dec1942e60e93ae15b393be0e018",
        "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2",
    ),
    (
        "sha256:48819e3927b9e794fa5a1c24de9768c5b20b25feba1880e89394a66d33eff9e9",
        "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2",
    ),
    (
        "sha256:6c02b1ccf7fbad840641ef5b26f5517755d4a4d9c3780cf3864b20947cddfc2c",
        "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2",
    ),
)
_HISTORICAL_REVIEW_STATUS = "approved-with-notes"
_HISTORICAL_FILE_COUNT = 69
_CURRENT_FILE_COUNT = 65


def _content_fingerprint(root: Path, files: tuple[str, ...] | list[str]) -> str:
    digest = hashlib.sha256()
    for relative_path in files:
        digest.update(relative_path.encode("utf-8"))
        digest.update(b"\0")
        digest.update((root / relative_path).read_bytes())
        digest.update(b"\0")
    return f"sha256:{digest.hexdigest()}"


def _assert_historical_review_identity(reviews: dict[str, object]) -> None:
    assert reviews["status"] == _HISTORICAL_REVIEW_STATUS
    assert reviews["reviewedImplementationFingerprint"] == (
        _HISTORICAL_REVIEWED_FINGERPRINT
    )


def _read_harness_json_constant(source: str, name: str) -> object:
    match = re.search(
        rf"^const {re.escape(name)} = (?P<literal>.+);$",
        source,
        flags=re.MULTILINE,
    )
    assert match is not None
    return json.loads(match.group("literal"))


def _read_harness_exclusions(source: str) -> tuple[str, ...]:
    match = re.search(
        r"^const SIX_MINISTRY_RUNTIME_CONTENT_EXCLUSIONS = Object\.freeze\(\[\n"
        r"(?P<items>(?:  \"[^\"\n]+\",\n)+)"
        r"\]\);$",
        source,
        flags=re.MULTILINE,
    )
    assert match is not None
    return tuple(
        json.loads(line.strip().removesuffix(","))
        for line in match.group("items").splitlines()
    )


@pytest.mark.parametrize(
    "review_drift",
    [
        {"status": "changes-requested", "reviewedImplementationFingerprint": None},
        {"status": "approved"},
        {"status": "approved-with-notes", "reviewedImplementationFingerprint": None},
    ],
)
def test_historical_review_identity_fails_closed_on_provenance_drift(
    review_drift: dict[str, object],
) -> None:
    report = json.loads(_REPORT.read_text(encoding="utf-8"))
    reviews = {**report["validationEvidence"]["independentReviews"], **review_drift}

    with pytest.raises(AssertionError):
        _assert_historical_review_identity(reviews)


def test_readiness_report_satisfies_a_closed_json_schema() -> None:
    report = json.loads(_REPORT.read_text(encoding="utf-8"))
    schema = json.loads(_SCHEMA.read_text(encoding="utf-8"))

    jsonschema.Draft202012Validator.check_schema(schema)
    jsonschema.validate(report, schema, cls=jsonschema.Draft202012Validator)


def test_readiness_report_covers_every_family_and_is_honest_about_authority() -> None:
    report = json.loads(_REPORT.read_text(encoding="utf-8"))
    matrix = json.loads(_MATRIX.read_text(encoding="utf-8"))
    family_rows = report["capabilityFamilies"]

    assert report["schemaVersion"] == "2.0.0"
    assert report["sourceCommit"] == "939186f0331d9784bc8c4ceee393aeb197230ed0"
    assert len(family_rows) == matrix["summary"]["familyCount"] == 23
    assert {item["familyId"] for item in family_rows} == {
        item["id"] for item in matrix["families"]
    }
    assert all(item["externalSideEffectsObserved"] is False for item in family_rows)
    assert all(item["productionPromotionAuthorized"] is False for item in family_rows)
    assert report["summary"] == {
        "sourceAssets": 1777,
        "families": 23,
        "activeFamilies": 22,
        "retiredFamilies": 1,
        "runtimeSkillDefinitionsCovered": 46,
        "businessSuccessMeasuredFamilies": 0,
        "serverOwnedResolverBindings": 6,
        "externalSideEffectsObserved": False,
        "productionPromotionAuthorized": False,
    }


def test_readiness_evidence_is_bound_to_current_implementation() -> None:
    report = json.loads(_REPORT.read_text(encoding="utf-8"))
    implementation = report["implementationEvidence"]
    files = implementation["files"]

    assert files == sorted(files)
    assert len(files) == len(set(files)) == _HISTORICAL_FILE_COUNT
    assert all(files.count(relative_path) == 1 for relative_path in _CURRENT_CONTENT_EXCLUSIONS)

    current_content_files = [
        relative_path
        for relative_path in files
        if relative_path not in _CURRENT_CONTENT_EXCLUSIONS
    ]
    assert len(current_content_files) == _CURRENT_FILE_COUNT

    for relative_path in files:
        path = _ROOT / relative_path
        assert path.is_file()
    current = _content_fingerprint(_ROOT, current_content_files)
    successor = _content_fingerprint(_ROOT, _SUCCESSOR_CONTENT_PATHS)
    assert (current, successor) in _CONTENT_FINGERPRINT_PAIRS
    assert implementation["fingerprint"] == _HISTORICAL_REVIEWED_FINGERPRINT
    assert (
        report["validationEvidence"]["implementationFingerprint"]
        == _HISTORICAL_REVIEWED_FINGERPRINT
    )
    reviews = report["validationEvidence"]["independentReviews"]
    _assert_historical_review_identity(reviews)


def test_python_and_harness_validators_share_the_exact_content_policy() -> None:
    source = _HARNESS.read_text(encoding="utf-8")

    assert _read_harness_exclusions(source) == _CURRENT_CONTENT_EXCLUSIONS
    assert tuple(
        _read_harness_json_constant(source, "SIX_MINISTRY_SUCCESSOR_CONTENT_PATHS")
    ) == _SUCCESSOR_CONTENT_PATHS
    assert tuple(
        tuple(pair)
        for pair in _read_harness_json_constant(
            source, "SIX_MINISTRY_CONTENT_FINGERPRINT_PAIRS"
        )
    ) == _CONTENT_FINGERPRINT_PAIRS
    assert (
        _read_harness_json_constant(source, "SIX_MINISTRY_REVIEW_STATUS")
        == _HISTORICAL_REVIEW_STATUS
    )
    assert (
        _read_harness_json_constant(
            source, "SIX_MINISTRY_REVIEWED_IMPLEMENTATION_FINGERPRINT"
        )
        == _HISTORICAL_REVIEWED_FINGERPRINT
    )
    assert (
        _read_harness_json_constant(source, "SIX_MINISTRY_HISTORICAL_FILE_COUNT")
        == _HISTORICAL_FILE_COUNT
    )
    assert (
        _read_harness_json_constant(source, "SIX_MINISTRY_RUNTIME_CONTENT_FILE_COUNT")
        == _CURRENT_FILE_COUNT
    )


def test_content_pair_rejects_mixed_or_third_state() -> None:
    unknown = "sha256:" + "0" * 64
    valid_pairs = set(_CONTENT_FINGERPRINT_PAIRS)
    runtime_fingerprints = {*(pair[0] for pair in valid_pairs), unknown}
    successor_fingerprints = {*(pair[1] for pair in valid_pairs), unknown}

    assert len(valid_pairs) == len(_CONTENT_FINGERPRINT_PAIRS) == 22
    for runtime_fingerprint in runtime_fingerprints:
        for successor_fingerprint in successor_fingerprints:
            candidate = (runtime_fingerprint, successor_fingerprint)
            if candidate not in valid_pairs:
                assert candidate not in _CONTENT_FINGERPRINT_PAIRS


def test_content_pair_policy_appends_only_the_approved_seventh_pair() -> None:
    predecessor_pairs = (
        (
            "sha256:013bfb8272e936be85c2d470033787c3b7f105ad6eae2dfe680373df023b5e69",
            "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
        ),
        (
            "sha256:c95630be3d79f2641ff6e483f4096b0763b9e5071544f1e0ead0d7e24eb1cba5",
            "sha256:268cab13e516d0f716f600819f2bddc8242269312d392eca4ed1be2de05ce051",
        ),
        (
            "sha256:d330b7f177f5bbb761eb359ffffca6f12250e5bbe90d13d0414d0fdefb78e98a",
            "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
        ),
        (
            "sha256:da31e8098bf76c72ff8d00b073d86e3442b0811223ef3e3bab770af31e89c28e",
            "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
        ),
    )
    fifth_pair = (
        "sha256:a6d109de75e877620a89241a4dcabcc716e1a5a1a18a024c9a3cb73e578de80c",
        "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
    )
    sixth_pair = (
        "sha256:cc42339eaa423d71307ef96ff713ec095a89ba2cc4d4f6630ee1b40dec94d34d",
        "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
    )
    approved_pair = (
        "sha256:eb0d8d214c2dc51ca4eb37ce5a13423e424fd6fdd3b6b8c3dac6a5f5757bd2df",
        "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
    )
    expected_pairs = (*predecessor_pairs, fifth_pair, sixth_pair, approved_pair)

    assert _CONTENT_FINGERPRINT_PAIRS[:7] == expected_pairs
    assert len(set(_CONTENT_FINGERPRINT_PAIRS[:7])) == len(expected_pairs) == 7

    unknown_runtime = "sha256:" + "f" * 64
    unknown_successor = "sha256:" + "e" * 64
    tampered_runtime = f"{approved_pair[0][:-1]}{'0' if approved_pair[0][-1] != '0' else '1'}"
    tampered_successor = (
        f"{approved_pair[1][:-1]}{'0' if approved_pair[1][-1] != '0' else '1'}"
    )
    rejected_pairs = (
        (approved_pair[0], unknown_successor),
        (unknown_runtime, approved_pair[1]),
        (approved_pair[0], predecessor_pairs[1][1]),
        (predecessor_pairs[1][0], approved_pair[1]),
        (unknown_runtime, unknown_successor),
        (tampered_runtime, approved_pair[1]),
        (approved_pair[0], tampered_successor),
    )
    assert all(pair not in _CONTENT_FINGERPRINT_PAIRS for pair in rejected_pairs)


def test_content_pair_policy_appends_only_the_approved_eighth_pair() -> None:
    predecessor_pairs = _CONTENT_FINGERPRINT_PAIRS[:7]
    approved_pair = (
        "sha256:82885fc13cec86318e4436fccfd80c78d7880e4aa25cdb530d0f4d18c9c73fe3",
        "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
    )
    expected_pairs = (*predecessor_pairs, approved_pair)

    assert _CONTENT_FINGERPRINT_PAIRS[:8] == expected_pairs
    assert len(set(_CONTENT_FINGERPRINT_PAIRS[:8])) == len(expected_pairs) == 8

    unknown_runtime = "sha256:" + "d" * 64
    unknown_successor = "sha256:" + "c" * 64
    tampered_runtime = f"{approved_pair[0][:-1]}{'0' if approved_pair[0][-1] != '0' else '1'}"
    tampered_successor = (
        f"{approved_pair[1][:-1]}{'0' if approved_pair[1][-1] != '0' else '1'}"
    )
    rejected_pairs = (
        (approved_pair[0], unknown_successor),
        (unknown_runtime, approved_pair[1]),
        (approved_pair[0], predecessor_pairs[1][1]),
        (predecessor_pairs[1][0], approved_pair[1]),
        (unknown_runtime, unknown_successor),
        (tampered_runtime, approved_pair[1]),
        (approved_pair[0], tampered_successor),
    )
    assert all(pair not in _CONTENT_FINGERPRINT_PAIRS for pair in rejected_pairs)


def test_content_pair_policy_appends_only_the_approved_ninth_pair() -> None:
    predecessor_pairs = _CONTENT_FINGERPRINT_PAIRS[:8]
    approved_pair = (
        "sha256:598dd8e735ce98b2d8a5307c3fa8b866d8fe72521c92b0c6ea4ba360d7bc9f79",
        "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924",
    )
    expected_pairs = (*predecessor_pairs, approved_pair)

    assert _CONTENT_FINGERPRINT_PAIRS[:9] == expected_pairs
    assert len(set(_CONTENT_FINGERPRINT_PAIRS[:9])) == len(expected_pairs) == 9

    unknown_runtime = "sha256:" + "b" * 64
    unknown_successor = "sha256:" + "a" * 64
    tampered_runtime = f"{approved_pair[0][:-1]}{'0' if approved_pair[0][-1] != '0' else '1'}"
    tampered_successor = (
        f"{approved_pair[1][:-1]}{'0' if approved_pair[1][-1] != '0' else '1'}"
    )
    rejected_pairs = (
        (approved_pair[0], unknown_successor),
        (unknown_runtime, approved_pair[1]),
        (approved_pair[0], predecessor_pairs[1][1]),
        (predecessor_pairs[1][0], approved_pair[1]),
        (unknown_runtime, unknown_successor),
        (tampered_runtime, approved_pair[1]),
        (approved_pair[0], tampered_successor),
    )
    assert all(pair not in _CONTENT_FINGERPRINT_PAIRS for pair in rejected_pairs)


def test_content_pair_policy_appends_only_the_approved_tenth_pair() -> None:
    predecessor_pairs = _CONTENT_FINGERPRINT_PAIRS[:9]
    approved_pair = (
        "sha256:32ecf613778ddc625567b08ec4526efbf22c0cd29a8c94fc3b9bacbe4e0dd05e",
        "sha256:9d10d2bed258e632c909719f05df50c6b33530d9f40be2458a38dd063fcde3c5",
    )
    expected_pairs = (*predecessor_pairs, approved_pair)

    assert _CONTENT_FINGERPRINT_PAIRS[:10] == expected_pairs
    assert len(set(_CONTENT_FINGERPRINT_PAIRS[:10])) == len(expected_pairs) == 10

    unknown_runtime = "sha256:" + "8" * 64
    unknown_successor = "sha256:" + "7" * 64
    tampered_runtime = f"{approved_pair[0][:-1]}{'0' if approved_pair[0][-1] != '0' else '1'}"
    tampered_successor = (
        f"{approved_pair[1][:-1]}{'0' if approved_pair[1][-1] != '0' else '1'}"
    )
    rejected_pairs = (
        (approved_pair[0], unknown_successor),
        (unknown_runtime, approved_pair[1]),
        (approved_pair[0], predecessor_pairs[1][1]),
        (predecessor_pairs[1][0], approved_pair[1]),
        (unknown_runtime, unknown_successor),
        (tampered_runtime, approved_pair[1]),
        (approved_pair[0], tampered_successor),
    )
    assert all(pair not in _CONTENT_FINGERPRINT_PAIRS for pair in rejected_pairs)


def test_content_pair_policy_appends_only_the_approved_eleventh_pair() -> None:
    predecessor_pairs = _CONTENT_FINGERPRINT_PAIRS[:10]
    approved_pair = (
        "sha256:32ecf613778ddc625567b08ec4526efbf22c0cd29a8c94fc3b9bacbe4e0dd05e",
        "sha256:1922b611550d73daa6226d9dd8abf8d9f9691a0501f9f1fd0ea83e8c772829d2",
    )
    expected_pairs = (*predecessor_pairs, approved_pair)

    assert _CONTENT_FINGERPRINT_PAIRS[:11] == expected_pairs
    assert len(set(_CONTENT_FINGERPRINT_PAIRS[:11])) == len(expected_pairs) == 11

    unknown_runtime = "sha256:" + "6" * 64
    unknown_successor = "sha256:" + "5" * 64
    tampered_runtime = f"{approved_pair[0][:-1]}{'0' if approved_pair[0][-1] != '0' else '1'}"
    tampered_successor = (
        f"{approved_pair[1][:-1]}{'0' if approved_pair[1][-1] != '0' else '1'}"
    )
    rejected_pairs = (
        (approved_pair[0], unknown_successor),
        (unknown_runtime, approved_pair[1]),
        (approved_pair[0], predecessor_pairs[1][1]),
        (predecessor_pairs[1][0], approved_pair[1]),
        (unknown_runtime, unknown_successor),
        (tampered_runtime, approved_pair[1]),
        (approved_pair[0], tampered_successor),
    )
    assert all(pair not in _CONTENT_FINGERPRINT_PAIRS for pair in rejected_pairs)


def test_content_pair_policy_appends_only_the_approved_twelfth_pair() -> None:
    predecessor_pairs = _CONTENT_FINGERPRINT_PAIRS[:11]
    approved_pair = (
        "sha256:598dd8e735ce98b2d8a5307c3fa8b866d8fe72521c92b0c6ea4ba360d7bc9f79",
        "sha256:43cf0adb1d4312e17fef0ec33ca963dbbc98b30d92d9f558a901f0d3ec0a9fea",
    )
    expected_pairs = (*predecessor_pairs, approved_pair)

    assert _CONTENT_FINGERPRINT_PAIRS[:12] == expected_pairs
    assert len(set(_CONTENT_FINGERPRINT_PAIRS[:12])) == len(expected_pairs) == 12

    unknown_runtime = "sha256:" + "4" * 64
    unknown_successor = "sha256:" + "3" * 64
    tampered_runtime = f"{approved_pair[0][:-1]}{'0' if approved_pair[0][-1] != '0' else '1'}"
    tampered_successor = (
        f"{approved_pair[1][:-1]}{'0' if approved_pair[1][-1] != '0' else '1'}"
    )
    rejected_pairs = (
        (approved_pair[0], unknown_successor),
        (unknown_runtime, approved_pair[1]),
        (approved_pair[0], predecessor_pairs[1][1]),
        (predecessor_pairs[1][0], approved_pair[1]),
        (unknown_runtime, unknown_successor),
        (tampered_runtime, approved_pair[1]),
        (approved_pair[0], tampered_successor),
    )
    assert all(pair not in _CONTENT_FINGERPRINT_PAIRS for pair in rejected_pairs)


def test_content_pair_policy_appends_only_the_approved_thirteenth_pair() -> None:
    predecessor_pairs = _CONTENT_FINGERPRINT_PAIRS[:12]
    approved_pair = (
        "sha256:598dd8e735ce98b2d8a5307c3fa8b866d8fe72521c92b0c6ea4ba360d7bc9f79",
        "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2",
    )
    expected_pairs = (*predecessor_pairs, approved_pair)

    assert _CONTENT_FINGERPRINT_PAIRS[:13] == expected_pairs
    assert len(set(expected_pairs)) == len(expected_pairs) == 13

    unknown_runtime = "sha256:" + "2" * 64
    unknown_successor = "sha256:" + "1" * 64
    tampered_runtime = f"{approved_pair[0][:-1]}{'0' if approved_pair[0][-1] != '0' else '1'}"
    tampered_successor = (
        f"{approved_pair[1][:-1]}{'0' if approved_pair[1][-1] != '0' else '1'}"
    )
    rejected_pairs = (
        (approved_pair[0], unknown_successor),
        (unknown_runtime, approved_pair[1]),
        (approved_pair[0], predecessor_pairs[1][1]),
        (predecessor_pairs[1][0], approved_pair[1]),
        (unknown_runtime, unknown_successor),
        (tampered_runtime, approved_pair[1]),
        (approved_pair[0], tampered_successor),
    )
    assert all(pair not in _CONTENT_FINGERPRINT_PAIRS for pair in rejected_pairs)


def test_content_pair_policy_appends_only_the_approved_fourteenth_pair() -> None:
    predecessor_pairs = _CONTENT_FINGERPRINT_PAIRS[:13]
    approved_pair = (
        "sha256:9e8729a88bc797c01d59818fb67d852025a9c679fdd7eb6e8fe63f26cbc8d365",
        "sha256:6b9521165b821729a3548f3535b90c30aab9b874c81b1b1b437bb5af64d06e34",
    )
    expected_pairs = (*predecessor_pairs, approved_pair)

    assert _CONTENT_FINGERPRINT_PAIRS[:14] == expected_pairs
    assert len(set(_CONTENT_FINGERPRINT_PAIRS[:14])) == len(expected_pairs) == 14

    unknown_runtime = "sha256:" + "8" * 64
    unknown_successor = "sha256:" + "7" * 64
    tampered_runtime = f"{approved_pair[0][:-1]}{'0' if approved_pair[0][-1] != '0' else '1'}"
    tampered_successor = (
        f"{approved_pair[1][:-1]}{'0' if approved_pair[1][-1] != '0' else '1'}"
    )
    rejected_pairs = (
        (approved_pair[0], unknown_successor),
        (unknown_runtime, approved_pair[1]),
        (approved_pair[1], approved_pair[0]),
        *((approved_pair[0], successor) for _, successor in predecessor_pairs),
        *((runtime, approved_pair[1]) for runtime, _ in predecessor_pairs),
        (unknown_runtime, unknown_successor),
        (tampered_runtime, approved_pair[1]),
        (approved_pair[0], tampered_successor),
    )
    assert all(pair not in _CONTENT_FINGERPRINT_PAIRS for pair in rejected_pairs)


def test_content_pair_policy_appends_only_reviewed_head_and_r1_pairs() -> None:
    predecessor_pairs = _CONTENT_FINGERPRINT_PAIRS[:14]
    head_pair = (
        "sha256:33baa33eebcbefbb09f85fb09b4f49baf145b667eabdfe2be3c245f43f39f2f7",
        "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2",
    )
    r1_pair = (
        "sha256:7a1220fa7c583de7248eca3ef6deac9b50635f73bf08d569190a3505b62db628",
        "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2",
    )

    assert _CONTENT_FINGERPRINT_PAIRS[:16] == (*predecessor_pairs, head_pair, r1_pair)
    assert len(set(_CONTENT_FINGERPRINT_PAIRS[:16])) == 16
    assert head_pair != r1_pair


def test_content_policy_keeps_exactly_four_exclusions() -> None:
    fifth_exclusion = "backend/app/api/decrees.py"
    source = _HARNESS.read_text(encoding="utf-8")

    assert len(_CURRENT_CONTENT_EXCLUSIONS) == 4
    assert fifth_exclusion not in _CURRENT_CONTENT_EXCLUSIONS
    assert _read_harness_exclusions(source) == _CURRENT_CONTENT_EXCLUSIONS
    assert _read_harness_exclusions(source) != (
        *_CURRENT_CONTENT_EXCLUSIONS,
        fifth_exclusion,
    )


def test_successor_content_rejects_third_state_drift(tmp_path: Path) -> None:
    for relative_path in _SUCCESSOR_CONTENT_PATHS:
        target = tmp_path / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes((_ROOT / relative_path).read_bytes())

    successor_fingerprints = tuple(pair[1] for pair in _CONTENT_FINGERPRINT_PAIRS)
    assert _content_fingerprint(tmp_path, _SUCCESSOR_CONTENT_PATHS) in successor_fingerprints
    drifted = tmp_path / _SUCCESSOR_CONTENT_PATHS[0]
    drifted.write_bytes(drifted.read_bytes() + b"\n# successor drift\n")
    assert _content_fingerprint(tmp_path, _SUCCESSOR_CONTENT_PATHS) not in successor_fingerprints


def test_readiness_lists_only_the_six_server_owned_resolver_boundaries() -> None:
    report = json.loads(_REPORT.read_text(encoding="utf-8"))

    assert [item["resolverId"] for item in report["resolverBindings"]] == [
        "current-user-owner",
        "committed-decree-authority",
        "owner-scoped-jinyiwei-evidence",
        "owner-run-accounting-work-product",
        "owner-run-junjichu-report-receipt",
        "owner-scoped-shiguan-reply",
    ]


def test_active_readiness_rows_match_generated_runtime_projection_exactly() -> None:
    report = json.loads(_REPORT.read_text(encoding="utf-8"))
    active_rows = {
        item["familyId"]: item
        for item in report["capabilityFamilies"]
        if item["runtimeStatus"] != "retired"
    }
    bindings = {item.family_id: item for item in load_capability_family_bindings()}
    registry_ids = {
        skill.skill_id for skill in build_default_downstream_skill_registry().skills
    }

    assert set(active_rows) == set(bindings)
    assert {
        skill_id
        for item in active_rows.values()
        for skill_id in item["runtimeSkillIds"]
    } == registry_ids
    for family_id, binding in bindings.items():
        row = active_rows[family_id]
        assert tuple(row["runtimeSkillIds"]) == binding.runtime_skill_ids
        assert row["sourceAssetCount"] == binding.source_asset_count
        assert row["runtimeStatus"] == "degraded-until-authority-evidence"
        assert row["businessSuccessMeasured"] is False
        assert row["contractShapeExercised"] is True
        assert row["missingProductionDependencies"]


def test_integration_pair_preserves_all_predecessors_and_rejects_cross_pairs() -> None:
    """Register only the reviewed pair; independent halves never authorize code."""
    expected_pair = (
        "sha256:c711c32fea39b31177e49f836455102a25fc4b9662363075b24fc25efb73991f",
        "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2",
    )
    new_pair = (
        "sha256:9a78e2b67840d116179d755fd3d9949643d7dec1942e60e93ae15b393be0e018",
        "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2",
    )
    successor_pair = (
        "sha256:48819e3927b9e794fa5a1c24de9768c5b20b25feba1880e89394a66d33eff9e9",
        "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2",
    )
    predecessors = _CONTENT_FINGERPRINT_PAIRS[:18]
    predecessor_bytes = json.dumps(predecessors, separators=(",", ":")).encode()
    assert hashlib.sha256(predecessor_bytes).hexdigest() == (
        "7a625855ba3d4cbc2764d4ffaff96a5ea2dba824ac5eb33ce4aa99788720adc4"
    )
    assert _CONTENT_FINGERPRINT_PAIRS == (
        *predecessors,
        expected_pair,
        new_pair,
        successor_pair,
        (
            "sha256:6c02b1ccf7fbad840641ef5b26f5517755d4a4d9c3780cf3864b20947cddfc2c",
            "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2",
        ),
    )
    assert len(set(_CONTENT_FINGERPRINT_PAIRS)) == 22
    unknown = "sha256:" + "0" * 64
    rejected = [(expected_pair[0], unknown), (unknown, expected_pair[1])]
    rejected += [(runtime, expected_pair[1]) for runtime, _ in predecessors]
    rejected += [(expected_pair[0], successor) for _, successor in predecessors]
    for index in (0, 1):
        tampered = list(expected_pair)
        value = tampered[index]
        tampered[index] = value[:-1] + ("1" if value[-1] == "0" else "0")
        rejected.append(tuple(tampered))
    accepted = {
        *predecessors,
        expected_pair,
        new_pair,
        successor_pair,
        (
            "sha256:6c02b1ccf7fbad840641ef5b26f5517755d4a4d9c3780cf3864b20947cddfc2c",
            "sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2",
        ),
    }
    assert all(
        candidate in accepted or candidate not in _CONTENT_FINGERPRINT_PAIRS
        for candidate in rejected
    )

