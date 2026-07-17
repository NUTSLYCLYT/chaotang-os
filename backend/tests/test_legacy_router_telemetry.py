from web.routers import forecast_intel_taiyi, qintian_forecast


def test_qintian_compat_router_records_each_legacy_call(monkeypatch):
    calls = []
    monkeypatch.setattr(
        "src.migration_telemetry.record_legacy_endpoint_call",
        lambda **event: calls.append(event),
    )

    qintian_forecast.qintian_scenarios()
    qintian_forecast.qintian_scenarios_generate()
    qintian_forecast.qintian_learning_path("forecast-1")

    assert [(event["endpoint"], event["operation"]) for event in calls] == [
        ("qintian_forecast.scenarios", "read"),
        ("qintian_forecast.scenarios.generate", "write"),
        ("qintian_forecast.learning-path", "read"),
    ]


def test_forecast_intel_taiyi_router_records_each_legacy_call(monkeypatch):
    calls = []
    monkeypatch.setattr(
        "src.migration_telemetry.record_legacy_endpoint_call",
        lambda **event: calls.append(event),
    )

    forecast_intel_taiyi.court_intel()
    forecast_intel_taiyi.court_forecast()
    forecast_intel_taiyi.taiyi_dashboard()
    forecast_intel_taiyi.taiyi_news()

    assert [event["endpoint"] for event in calls] == [
        "forecast_intel_taiyi.intel",
        "forecast_intel_taiyi.forecast",
        "forecast_intel_taiyi.taiyi.dashboard",
        "forecast_intel_taiyi.taiyi.news",
    ]
