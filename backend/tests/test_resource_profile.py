from fastapi.testclient import TestClient


def _client(monkeypatch, tmp_path):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    monkeypatch.setattr("src.user_preference.DEFAULT_PREFERENCE_DIR", str(tmp_path / "preferences"))
    from web.main import app

    return TestClient(app)


def test_resource_profile_defaults_to_chaotang_resources(monkeypatch, tmp_path):
    client = _client(monkeypatch, tmp_path)

    r = client.get("/api/resources/profile")

    assert r.status_code == 200
    body = r.json()
    assert body["selectedMode"] == "chaotang_default"
    assert body["neverReplaceUserResources"] is True
    assert "qintianjian" in body["activeResources"]


def test_resource_profile_can_switch_to_hybrid(monkeypatch, tmp_path):
    client = _client(monkeypatch, tmp_path)

    r = client.post("/api/resources/profile", json={"mode": "hybrid"})

    assert r.status_code == 200
    body = r.json()
    assert body["selectedMode"] == "hybrid"
    assert "user_knowledge" in body["activeResources"]
    assert "shiguan_archive" in body["activeResources"]


def test_resource_profile_rejects_unknown_mode(monkeypatch, tmp_path):
    client = _client(monkeypatch, tmp_path)

    r = client.post("/api/resources/profile", json={"mode": "replace_everything"})

    assert r.status_code == 422


def test_user_own_mode_does_not_yet_isolate_provider_selection(monkeypatch, tmp_path):
    """诚实回归,不是 bug 复现:docs/shiguan/resource_profile_policy.md 自己写着
    "未实现:按资源模式动态改 FlowEngine 注入资源"——这是已知、已文档化的"下一阶段"
    边界,不是这轮该修的洞。这条测试把边界钉死成可验证的事实,不是留一句没人查的承诺:
    以后真做了资源隔离,这条测试会先失败,提醒改这里同时也要更新这条断言和上面那份文档。

    验证两层:
    1. 用户切到 user_own 模式,偏好确实存住了(resource_profile 这一半是真的)。
    2. src.provider.get_active_provider()——flow 执行链真正读 provider 的地方——
       不接受 user_id/tenant/resource_mode 任何参数,只读全局 config/providers.yaml,
       跟这次切换的 user_own 偏好完全无关。今天确实如此,不冒充"已隔离"。
    """
    import inspect

    from src import provider as provider_mod

    client = _client(monkeypatch, tmp_path)
    r = client.post("/api/resources/profile", json={"mode": "user_own"})
    assert r.status_code == 200 and r.json()["selectedMode"] == "user_own"

    # 结构性证明,不是跑两次比对(那只会跟自己重复,证明不了什么):
    # get_active_provider() 不接受任何参数,物理上不可能知道"这次是谁、选了哪个模式"。
    sig = inspect.signature(provider_mod.get_active_provider)
    assert list(sig.parameters) == [], (
        "get_active_provider() 现在带参数了——如果这是为了消费 resource_profile,"
        "把这条测试和 docs/shiguan/resource_profile_policy.md 的'未实现'清单一起更新,"
        "不要留着一条过期的诚实声明。"
    )
    # 实现里也不该悄悄 import 这两个模块去做隐藏判断——没有参数却查了全局用户状态,
    # 比"完全没接"更危险(行为随上一个请求是谁而漂移)。
    src = inspect.getsource(provider_mod)
    assert "resource_profile" not in src and "user_preference" not in src
