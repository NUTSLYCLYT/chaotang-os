@AGENTS.md

> Claude Code 入口：本仓规则的真相源是同目录 `AGENTS.md`（Codex 也读它），此处用 `@AGENTS.md` 导入，
> 不维护第二套平行文本。全局工作约定见 `~/.claude/CLAUDE.md`。

## 本仓速记（最高优先级）

- 本仓只承接**后端 / 蜂群 / flow / agent / harness / 质量基线 / 真实客户样本**；前端/网站/浏览器验证回 `/home/ubuntu/workspace/chaotang-web-lyt`。
- 后端端口优先 **8081**；不混合前端提交。
- Git：禁 `git add .`，文件级分拣；提交前跑 `python scripts/commit_closeout_check.py`；推 `git@gitee.com:msxn/jiqun_ai.git`。
- harness/flow 改动按需调 lens：`flow-engine-god` + `python-god`（引擎）、`eval-governance-god` + `harness-god`（评测/治理）、`decision-guard-god` + `bruce-schneier`（不可逆决策）。
