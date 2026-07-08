# 锦衣卫 · 开源天眼 Harness

目标：持续筛选对朝堂主线有价值的开源项目，避免靠临时灵感追热点。

默认只做离线候选评分，不直接联网。锦衣卫可先把 GitHub Trending、GitHub Search、deps.dev、社区推荐里的候选写入 `candidates.json`，再运行评分器。

## 工作流

```text
候选 repo
-> 锦衣卫初筛
-> 开源天眼评分
-> 钦天监判断是否值得 POC
-> 工部 2 小时 POC
-> 御史/刑部许可证与安全检查
-> 史馆 adopted / watch / reject / must_not 归档
```

## 运行

```bash
python harness/open_source_watch/scripts/score_repos.py
```

可选：用 GitHub REST API 补全 stars、license、主语言、最近 push 时间，并把取数证据写入报告。

```bash
python harness/open_source_watch/scripts/score_repos.py --enrich-github
```

如果需要更高 rate limit，可在本地设置只读 token：

```bash
GITHUB_TOKEN=... python harness/open_source_watch/scripts/score_repos.py --enrich-github
```

输出：

- `harness/open_source_watch/artifacts/latest.json`
- `harness/open_source_watch/artifacts/latest.md`

## 推荐动作

- `adopt`: 可直接进入能力建设或近期 POC。
- `poc`: 值得工部 2 小时验证。
- `watch`: 继续观察，不进入主线。
- `reject`: 不适合当前朝堂主线。
- `must_not`: 记录为坑点或风险样本。

## 工部安全 POC

`google/osv-scanner` 和 `ossf/scorecard` 进入 adopt 后，先用安全 POC runner 检查本机是否已经具备工具：

```bash
python harness/open_source_watch/scripts/run_security_poc.py
```

输出：

- `harness/open_source_watch/artifacts/security_poc_latest.json`
- `harness/open_source_watch/artifacts/security_poc_latest.md`

如果工具已安装，可执行实际 POC：

```bash
python harness/open_source_watch/scripts/run_security_poc.py --run-poc
```

当前官方安装路径：

- OSV-Scanner: `go install github.com/google/osv-scanner/v2/cmd/osv-scanner@latest`，或 `docker pull ghcr.io/google/osv-scanner:latest`
- OpenSSF Scorecard: `docker pull ghcr.io/ossf/scorecard:latest`，或从 GitHub releases 下载 standalone binary

Scorecard 远程仓库评分建议配置只读 `GITHUB_AUTH_TOKEN`，避免 GitHub rate limit。

也可以让工部安装器下载安装到本 harness 的本地工具目录：

```bash
python harness/open_source_watch/scripts/install_security_tools.py
```

安装位置 `harness/open_source_watch/tools/` 已忽略提交。安装器会读取 GitHub latest release，选择当前平台 asset，并校验 release API 提供的 `sha256` digest。

## 评分维度

每项 0-5：

1. `relevance`: 是否服务钦天监、史馆、harness、蜂群、御史。
2. `growth`: stars、活跃度、近期增长信号。
3. `integrability`: API/CLI/SDK/文档是否容易接入。
4. `security`: 许可证、依赖、权限、供应链风险。
5. `maintenance`: 最近维护、issue 健康度、社区成熟度。
6. `poc_cost`: 2 小时内能否验证价值。
7. `mainline_value`: 是否提升 `jiqun_ai` 主线，而不是只让 Web 好看。

## 阈值

```text
adopt >= 4.2 且无 block 风险
poc   >= 3.5 且无 block 风险
watch >= 2.8
reject < 2.8
must_not: 出现 license/security/abandoned/hype_only 等 block 风险
```

## 主线边界

这个 harness 只服务 `jiqun_ai` 主线：钦天监、蜂群、flow、harness、质量门禁、史馆证据链。

Web/UI 项目只能标为 `ui_optional`，不得直接进入主线实现。

## 证据链

在线补数只覆盖可验证字段，并在每个候选的 `evidence` 中记录：

- `source`: 数据源，例如 `github_repo_api`
- `url`: 请求 URL
- `fetched_at`: UTC 时间
- `status`: `ok` 或 `failed`
- `fields`: 覆盖过的字段

补数失败不直接扣分，但必须留痕，方便御史复核。
