# 失败记忆：共享 harness 的 Stop hook 未形成真实门禁

## Summary

共享 Stop hook 看似会在 Codex 或 Claude Code 结束前运行 harness 检查,但检查失败时
透传了普通退出码 `1`,并且成功时输出普通文本。任一客户端都可能把它当作 hook 错误
而不是要求 agent 继续修复,形成假门禁。

## Root Cause

实现只验证了 shell 脚本能调用检查器,没有分别验证 Codex 与 Claude Code 的 Stop hook
协议。两个客户端都要求结构化 `decision: "block"` 或专用阻断退出码;Stop 事件还
提供 `stop_hook_active` 防止无限继续。旧脚本既未转换协议,也未处理重复触发。

同时,共享脚本强制通过 Bash 启动 Node。在当前 Windows/WSL 组合中 Windows 有 Node,
但 WSL PATH 没有 Node,导致共享脚本在 WSL 内无法执行。

## Prevention

- 用跨平台 Node 入口 `.agents/hooks/check-harness.mjs` 统一适配两种客户端的 Stop 协议。
- 成功时不输出内容;首次失败输出结构化 block;重复失败只提示人工处理。
- 不在共享 hook 中强制切换 Bash/WSL,并把 Node 22 写入运行兼容基线。
- 配置检查必须解析 JSON 并核对准确的 Stop command,不能只搜索路径字符串。

## Detection

- `node .agents/hooks/check-harness.mjs --self-test` 验证成功静默、首次失败阻断和重复
  失败停止自动循环。
- `node scripts/check_harness.mjs` 精确解析 `.codex/hooks.json` 与
  `.claude/settings.json`,确认两个客户端使用同一 command。
- CI 同时运行检查器自测和 Stop hook 协议自测。
- 客户端协议是否真实触发仍需按 `docs/tooling-compatibility.md` 做一次人工冒烟检查;
  纯仓库测试不能证明本机客户端已信任并加载项目配置。

## Evidence

- `docs/decisions/0002-dual-tool-harness-sharing.md`
- `.agents/hooks/check-harness.mjs`
- `scripts/check_harness.mjs`
- `.github/workflows/harness.yml`
