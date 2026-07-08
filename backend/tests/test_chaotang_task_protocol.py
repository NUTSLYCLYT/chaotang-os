from scripts.chaotang_task_protocol import classify_task, render


def test_protocol_routes_irreversible_tasks_to_qintianjian():
    protocol = classify_task("上线自动执行客户报价流程")

    assert protocol.mode == "开钦天监"
    assert protocol.signoff_required is True


def test_protocol_routes_small_build_tasks_to_direct_mode():
    protocol = classify_task("修复 OPC 评分脚本并提交")

    assert protocol.mode == "直接做"
    assert protocol.signoff_required is False


def test_protocol_routes_learning_tasks_to_explain_mode():
    protocol = classify_task("小白解释一下 git 回滚是什么意思")

    assert protocol.mode == "只解释"


def test_protocol_render_includes_next_steps():
    output = render(classify_task("开发效率低，先审查"))

    assert "推荐模式：先审查" in output
    assert "下一步：" in output
