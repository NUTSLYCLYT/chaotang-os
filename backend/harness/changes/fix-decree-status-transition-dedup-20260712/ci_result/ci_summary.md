# CI 摘要：fix-decree-status-transition-dedup-20260712

## 命令

- `python3 -m pytest -q tests/test_shangshufang_loop_api.py tests/test_shangshufang_entry.py tests/test_outbox_worker.py`
- `python3 -m pytest -q tests/test_commercial_loop_harness.py tests/test_legal_redteam_harness.py`
- `python3 scripts/harness_doctor.py`

## 结果

- 26 passed, 1 failed(`test_chancellor_chat_streams_single_agent_reply`，`git stash` 验证过改动前就失败，与本次改动无关，真实 LLM 输出文本断言的既有 flaky 测试)。
- commercial-loop/legal-redteam：33 passed。
- harness_doctor：0 errors, 0 warnings。
