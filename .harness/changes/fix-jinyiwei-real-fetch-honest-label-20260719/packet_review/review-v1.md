# Packet P22 复审报告 v1（内部代号 PKT-A1）

- Change ID: `fix-jinyiwei-real-fetch-honest-label-20260719`
- Packet ID: P22
- 复审日期: 2026-07-19
- 复审人: Claude Code（本会话）

## 披露：同源复审

本包实现者与复审者为同一会话（非独立第三方）。缓解措施：push 闸机器校验
包结构与 SHA 绑定；全部验证命令独立实跑留痕；业主已在实现阶段审阅生产文件
完整 diff；EDGAR 真网验证使用非内置 ticker 消除"测试即实现"偏差。业主可
随时要求 Codex 补充第三方复审 v2。

## 固定 SHA

| 角色 | SHA |
| --- | --- |
| B（predecessor，Gitee ext tip） | `f6a73f3cc0679f8318806ca60a61e02e0abceff6` |
| H（实现候选，rebase 后单提交） | `9a6199754ac9003d6e46250d70f7520cb389ed56` |

- `git rev-parse H^` = B（单亲、非 merge）。
- `git diff --name-status B..H`：10 路径——新增 `backend/src/sec_edgar.py`、
  2 个测试文件、本 change 四件套；修改 contract、router、既有 loop API 测试。
- 恰好 1 个 root change `summary.md`；无 lockfile、providers 配置、var/ 运行态、
  前端文件。`git diff --check B..H` 干净。

## 实跑命令与结果（pkt-a1 worktree @ H）

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pytest -q`（后端全量，@前基 475763a 同代码树） | 0 | 2834 passed / 37 skipped / 0 failed（283.61s） |
| 金丝雀 6 文件（sec_edgar、honest_label、contract、loop_api、canonical_chain、engines） | 0 | 98 passed |
| 真网 smoke `gather_sec_evidence('NVDA')` | 0 | 全量表解析 CIK 0001045810、companyfacts 200、verified=True |
| 真网 smoke `gather_sec_evidence('TSLA')` | 0 | CIK 0001318605、verified=True（第二只非内置票） |
| `python3 scripts/harness_doctor.py`（backend） | 0 | 0 errors, 0 warning(s) |
| `node scripts/harness-doctor.mjs`（root） | 0 | 0 errors, 0 warning(s) |

## 基线重绑说明

原基线 `475763a` 在复审期间被远端推进到 `f6a73f3`（新 delta 经核实为纯
docs/json，0 个代码文件）。实现单提交 rebase 无冲突；全量 suite 结果对相同
代码树仍有效，金丝雀与 doctor 在新基线重跑通过。P21 号被远端 idempotency
包占用，本包顺延 P22。

## 重点审查结论

1. **真取证成立**：`sec_edgar.py` 对 companyfacts 真实 GET，仅 200 记
   verified；ticker→CIK 用 SEC 官方全量表（var 缓存 7 天，拉取失败回退过期
   缓存再回退内置两票）。两只非内置 ticker 真网命中证明 G1/G2 闭合。
2. **诚实标成立**：`LIVE_SWARM` 硬编码从本链清除（测试断言 session json
   无此值）；三态落既有词表 `LIVE/FALLBACK`，前端合同校验器零改动；
   `official_sources_verified` 新增质量门检查；timeline 取证只在真验证后标完成。
3. **安全**：无 SSRF（URL 常量模板 + CIK 为格式化整数，ticker 不入 URL）；
   无密钥引入；超时 8s 有界；全失败路径诚实降级不抛崩。
4. **测试有效性**：新 9 用例全 mock httpx，CI 不碰网；既有 loop API 测试注入
   stub fetcher 保持离线确定性；断言覆盖 verified/template/失败/用户自带四路径。

## Findings

| # | 级别 | 内容 | 处置 |
| --- | --- | --- | --- |
| F1 | LOW | 用户自带证据计入 evidence_verified 门禁但未实际抓取验证 | 延续既有"用户证据即请求标"约定，已注释；后续包可加用户 URL 可达性抽检 |
| F2 | LOW | 冷缓存最坏 2 次串行外网 GET（约 16s 上限）在请求路径内 | 内测量级可接受；PKT-A2 时评估预热/异步 |
| F3 | INFO | `evidence_fetcher: Any` 未定 Protocol | 第三个调用方出现时收紧 |
| F4 | INFO | swarm.py 旧调用方未接线，其 session 标签诚实降为 FALLBACK | 有意为之：形态不变、标签不再冒充 |

无 HIGH，无 MEDIUM。F1–F4 均不阻断。

## 复审纪律

- 复审基于固定 SHA B..H，独立 worktree，未动主工作树。
- 除本 review-only commit 外无额外提交；不 merge、不 rebase、不删他人分支。

PACKET_REVIEW_GO
