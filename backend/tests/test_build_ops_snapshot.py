from pathlib import Path


def test_ops_snapshot_contains_priorities():
    from scripts.build_ops_snapshot import build_snapshot

    snapshot = build_snapshot(Path(__file__).resolve().parent.parent)

    assert snapshot["coverage"]["flow_count"] >= 29
    assert snapshot["quality"]["threshold"] == 7.0
    assert isinstance(snapshot["immediate_priorities"], list)
    assert "cost_data_status" in snapshot["meta"]
