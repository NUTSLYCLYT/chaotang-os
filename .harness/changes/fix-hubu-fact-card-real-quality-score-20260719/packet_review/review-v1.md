# Packet P23 复审报告 v1（内部代号 PKT-A2）

- Change ID: `fix-hubu-fact-card-real-quality-score-20260719`
- Packet ID: P23
- 复审日期: 2026-07-19
- 复审人: Claude Code（本会话）

## 披露：同源复审

实现者与复审者同会话（同 P22 披露）。缓解：push 闸机器校验、全部命令实跑
留痕、事实卡断言用 fixture 与真网双验证、业主可要求 Codex 补 v2。

## 固定 SHA

| 角色 | SHA |
| --- | --- |
| B（predecessor，Gitee ext tip = P22 candidate） | `0ee467db058c36e8fe00d9b560453537b644bd93` |
| H（实现候选，单提交） | `36893eb8b3a10c427e00a425c7defabfa8e29a15` |

- `git rev-parse H^` = B（单亲）。8 路径：2 源码修改、2 测试扩展、本 change
  四件套；恰好 1 个 root change summary；无前端/lockfile/providers/var。

## 实跑命令与结果

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pytest -q`（全量） | 0 | 2839 passed / 37 skipped / 0 failed（231.88s） |
| 受影响 4 文件 | 0 | 40 passed |
| 真网 smoke NVDA | 0 | verified=True；5 指标全为 10-K 申报原值（营收 215.938B USD FY2026 等） |
| `grep quality_score=0.` contract | 1 | 常量零命中 |
| backend + root doctor | 0 | 均 0 errors, 0 warning(s) |

## 重点审查结论

1. **事实卡真实性**：`extract_key_facts` 只取 `form==10-K && fp==FY` 最新
   `end` 的申报值；10-Q 混入被 fixture 单测钉死；缺标签诚实缺席（fixture 断言
   total_assets 缺席）；解析异常不影响 verified 且 facts 退空——无编造路径。
2. **分数可追溯**：`_qa_score` = checks 通过率（无 checks 按 pass 布尔）；
   六处常量清零；分档语义单测锁定（锦衣卫 verified=1.0、模板=0.5）。
3. **红线不动**：factCard 纯申报数字，无估值结论；`nonAdviceDisclaimer`、
   `forbidden_outputs`、人工确认门均未触碰。
4. **兼容性**：factCard/`official_sources_verified` 为增量字段；标签词表、
   API 路径、前端合同校验器零改动；swarm.py 旧调用方行为不变。

## Findings

| # | 级别 | 内容 | 处置 |
| --- | --- | --- | --- |
| F1 | LOW | 事实卡仅覆盖 USD/10-K，外国私募发行人（20-F）与非 USD 单位缺席 | 诚实缺席非编造；国际化时扩标签链 |
| F2 | INFO | companyfacts body 可达数 MB，解析在请求路径内 | 实测 NVDA 解析毫秒级；量大再流式 |
| F3 | INFO | `_qa_score` 各检查等权 | 检查项增多后可加权，当前最简诚实 |

无 HIGH，无 MEDIUM。

## 复审纪律

固定 SHA B..H 复审；独立 worktree；除本 review-only commit 外无额外提交；
不 merge、不 rebase、不动主工作树。

PACKET_REVIEW_GO
