from pathlib import Path


def test_index_exposes_resource_profile_switch():
    html = (Path(__file__).resolve().parent.parent / "web" / "index.html").read_text(encoding="utf-8")

    assert "toggleResourceProfile" in html
    assert "/api/resources/profile" in html
    assert "不会静默替换" in html
    assert "保存选择" in html


def test_index_exposes_start_panel_before_debug_surface():
    html = (Path(__file__).resolve().parent.parent / "web" / "index.html").read_text(encoding="utf-8")

    assert "开始一个朝堂任务" in html
    assert "continueStartTask()" in html
    assert "直接运行" not in html
    assert "startFromPanel(" not in html
    assert "chaotang.start.dismissed" in html


def test_index_exposes_commercial_loop_dashboard():
    html = (Path(__file__).resolve().parent.parent / "web" / "index.html").read_text(encoding="utf-8")

    assert "toggleCommercialLoop" in html
    assert "/api/commercial-loop/dashboard" in html
    assert "商机闭环" in html
    assert "禁止动作" in html
    assert "Golden 审批" in html
    assert "reviewGoldenCandidate" in html
    assert "golden-candidates" in html
    assert "晋升必须填写 reference" in html
    assert "biz-reference" in html
    assert "人工 reference" in html
    assert "window.prompt" not in html


def test_index_can_force_and_focus_start_panel_after_login():
    html = (Path(__file__).resolve().parent.parent / "web" / "index.html").read_text(encoding="utf-8")

    assert "shouldForceStartPanel" in html
    assert "params.get('start')==='1'" in html
    assert "focusStartTask" in html
    assert "document.getElementById('startTask')?.focus()" in html


def test_index_preview_uses_human_hint_not_internal_protocol_terms():
    html = (Path(__file__).resolve().parent.parent / "web" / "index.html").read_text(encoding="utf-8")

    assert "/api/task-protocol/preview" in html
    assert "startHint" in html
    assert "START.preview.hint" in html
    assert "signoff_required" in html
