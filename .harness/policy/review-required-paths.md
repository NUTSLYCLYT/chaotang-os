# 强制二审路径（人工政策，非自动执行）

这三个文件任何改动都建议要求至少一名非提交者本人的复核，因为它们共同构成
`rolloutHistoryGate` 的信任边界，而检查代码和被检查状态同住一个仓库，本地脚本
天然防不住"同一次改动里把检查代码也删掉"（详见
`.harness/wiki/multi-agent-control-plane.md` 的 S10 rollout 小节，有一次隔离
clone 里实测过的具体绕过方式）：

- `scripts/harness-doctor.mjs`
- `.harness/manifest/project-harness.json`
- `.harness/rollout-history.jsonl`

**这份文件本身不会自动挡住任何提交。** 它只是一份人工政策声明。要让它真正有效，
需要在 Gitee 仓库设置里开启分支保护 + 强制指定人数/指定人复核（是否支持按路径
匹配复核人、具体开关叫什么，需要repo管理员登录 Gitee 后台确认，本会话没有 Gitee
后台访问权限，没有验证过）。在那之前，这三个文件的保护完全依赖"提交者自己愿意
遵守"，和其他没有工具强制的团队约定没有本质区别。
