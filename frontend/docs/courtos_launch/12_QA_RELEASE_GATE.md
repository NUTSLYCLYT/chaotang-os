# 12 QA Release Gate

本文件目的：定义 CourtOS 上线前必须通过的质量、发布和风险门禁，blocked 是正确拦截，不是失败噪音。
优先级：P0。

上线前所有门禁必须绿。门禁 blocked 不是错误，是风险被正确拦住。

## 能做什么

- 作为发布前最终检查清单。
- 区分前端门禁、后端门禁、部署门禁和禁止发布状态。
- 指导 Codex/Claude Code 做验收而不是开发新功能。

## 不能做什么

- 不能跳过 smoke/help/blocked 行为检查。
- 不能把 fallback/demo 包装成 live。
- 不能在高风险确认门、sourceLabel、史馆归档缺失时发布。

## 前端门禁

- `pnpm exec tsc --noEmit`
- `pnpm build`
- Playwright 桌面截图。
- Playwright 手机截图。
- 无横向溢出。
- `sourceLabel` 可见。
- fallback/demo 明示。
- 高风险确认门可见。

## 后端门禁

- `.venv/bin/python scripts/validate_flows.py`
- `.venv/bin/python scripts/validate_registry_sync.py`
- `.venv/bin/python scripts/commit_closeout_check.py`
- 本轮相关 pytest。

## 发布门禁

- HTTPS 正常。
- 登录权限正常。
- 数据库备份策略确认。
- 错误监控可见。
- 回滚方案可执行。
- 发布后健康检查可执行。

## 禁止发布

- P0 裁决闭环断。
- 高风险动作可静默通过。
- sourceLabel 缺失或 unknown 仍可裁决。
- 史馆归档丢失。
- fallback/demo 被包装成 live。

## 验收标准

- 前端、后端、发布门禁都有明确命令或人工检查项。
- 禁止发布项全部为否。
- blocked/requires_confirmation 被记录为正确风险拦截，而不是绕过或误报。

## 后续 Codex 可执行任务

```text
你是 CourtOS 上线门禁验收官。
只读执行当前仓库允许的类型检查、构建检查、相关测试和 smoke/help 安全检查。
失败即停止并输出日志、原因、最小修复建议。
不要自动修复，不要提交，不要启动真实蜂群。
```
