# 决策 0002：让 Codex 与 Claude Code 共享同一套 harness,而不是各存一份

## Status

Accepted — 2026-07-15

## Context

仓库需要允许开发者按任务选择 Codex 或 Claude Code，并让任一客户端读取同一套
harness 语义。这是客户端兼容架构，不是同时运行多个 agent 的编排方案。

此前 `.claude/` 和 `.codex/`
下各自维护了一份 Stop hook 脚本(`.claude/hooks/check-harness.sh` 与
`.codex/hooks/check-harness.sh`),内容逐字相同但物理上是两份文件;同时
`.claude/agents/harness-doctor.md` 与 `.codex/agents/harness-doctor.toml` 也是同一
职责说明的两份拷贝,只是格式不同(frontmatter Markdown vs TOML)。

`.agents/skills/record-decision`、`.agents/skills/record-failure` 这两个 skill 放在
`.agents/skills/` 下——这本是 Codex 的原生扫描路径,Codex 能直接发现;但 Claude
Code 只认 `.claude/skills/`,所以同样的 skill 对 Claude Code 实际不可调用,
`harness-doctor` 的职责描述里点名这两个 skill 却没有真正接通,造成两个工具的
实际能力不对称,而这个不对称之前没有任何检查能发现。

## Decision

- Hook 入口收敛为单一事实源 `.agents/hooks/check-harness.mjs`,`.claude/settings.json`
  与 `.codex/hooks.json` 的 Stop hook 都指向这份共享脚本,不再各存副本。
- 共享入口把检查结果转换为两端都接受的结构化 Stop 协议:成功静默,首次失败要求
  agent 继续,重复失败停止自动循环并提示人工处理。
- 在 `.claude/skills/record-decision`、`.claude/skills/record-failure` 下保留 Claude
  Code 原生发现所需的实际入口文件,并与 `.agents/skills/` 下的事实源做字节级比对。
  不使用 WSL 符号链接,因为 Windows Node 通过 UNC 无法稳定读取它们。
- `harness-doctor` 的职责说明(`.claude/agents/harness-doctor.md` 与
  `.codex/agents/harness-doctor.toml`)因为容器格式不同(Markdown+frontmatter vs
  TOML),无法用软链接合并;继续手动维护两份,但用机械比对代替口头承诺。
- `scripts/check_harness.mjs` 新增机械检查:
  - 旧的两份重复 hook 脚本不能复活。
  - `.claude/settings.json`、`.codex/hooks.json` 必须在 Stop command 中精确引用共享
    hook 命令。
  - `.claude/skills/*` 必须存在,且内容与 `.agents/skills/*` 完全一致。
  - `.claude/agents/harness-doctor.md` 与 `.codex/agents/harness-doctor.toml` 的
    `description` 与正文指令必须逐字一致。
  - 上述新文件全部加入 `REQUIRED_FILES`。

## Consequences

- 好处:两个客户端的 hook 行为、skill 能力、agent 职责说明保证一致,漂移会在
  `node scripts/check_harness.mjs` 或 CI 里直接报错,而不是靠人记得同步。
- 代价:`harness-doctor` 和 Claude Code 的 skill 入口仍然存在物理副本;
  一致性检查能防止"改了一份忘了另一份"的漂移,但不能消除维护两份的成本。
  如果未来这类需要跨格式同步的 agent 定义变多,可以考虑改用生成脚本从单一
  canonical 正文渲染出 `.md` 和 `.toml` 两份产物——当前只有一个 agent,先不
  引入这层机制。
- Claude Code 的 skill 列表现在会真实出现 `record-decision`、`record-failure`
  (此前不会),`AGENTS.md`/`ARCHITECTURE.md` 的既有说法不受影响,无需同步修改。

## Verification

- `node scripts/check_harness.mjs`
- `node scripts/check_harness.mjs --self-test`
- `node .agents/hooks/check-harness.mjs --self-test`
- 手动确认 Claude Code 当前会话的可用 skill 列表里出现 `record-decision`、
  `record-failure`。
