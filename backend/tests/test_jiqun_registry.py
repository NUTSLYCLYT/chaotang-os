from src.jiqun_registry import JiqunRegistry


def test_registry_lists_registered_swarms():
    registry = JiqunRegistry()

    swarms = registry.swarms()

    assert len(swarms) >= 17
    assert {s["id"] for s in swarms} >= {
        "haolong",
        "opc",
        "product",
        "quotation",
        "sourcing",
        "pack_rd",
        "battery_stage_gate",
        "finance",
        "legal",
        "xiaohongshu",
        "ima",
        "court",
        "ai_ops",
        "sdlc",
    }


def test_runtime_policy_keeps_subagent_as_default_and_openclaw_as_manor_upgrade():
    registry = JiqunRegistry()
    policy = registry.runtime_policy()

    assert policy["default"] == "subagent"
    assert "workflow_steps" in policy["subagent"]["use_for"]
    assert "long_running_manors" in policy["openclaw"]["use_for"]
    assert policy["openclaw"]["fallback"] == "subagent"


def test_review_committee_and_tail_flow_are_loadable():
    registry = JiqunRegistry()

    committee = registry.load_review_committee()
    tail = registry.load_global_tail_flow()

    assert committee["committee_id"] == "persona_review_committee"
    assert len(committee["personas"]) >= 8
    assert tail["tail_flow_id"] == "global_quality_tail"
    assert [s["id"] for s in tail["steps"][:3]] == [
        "qa_tech_support",
        "critic_challenge",
        "persona_review",
    ]


def test_registry_lists_subagents_and_persona_reviewers():
    registry = JiqunRegistry()

    agents = registry.list_agents()

    assert any(a["agent_id"] == "opc_leader" and a["swarm_id"] == "opc" for a in agents)
    assert any(a["agent_id"] == "critic" and a["swarm_id"] == "pack_rd" for a in agents)
    assert any(
        a["agent_id"] == "munger" and a["kind"] == "persona_reviewer" for a in agents
    )


def test_registry_validation_has_no_errors():
    registry = JiqunRegistry()

    issues = registry.validate()

    assert [i for i in issues if i.level == "error"] == []
