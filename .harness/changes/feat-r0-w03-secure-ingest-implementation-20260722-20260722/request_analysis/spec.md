# 规格说明：feat-r0-w03-secure-ingest-implementation-20260722-20260722

## 背景

R0-W03 已获 execution-authority v2 授权（GO），Product Owner 批准安全摄取与租户隔离实现，
OQ-02（20MB/100页）、OQ-06（provider policy 全 UNKNOWN 上线）、admin 零例外、真病毒扫描
排除 R0 范围四项设计确认。本变更交付 packet card 产物：对象级 secure ingest、MIME/加密/
损坏/宏/zip bomb/注入检查、OCR 状态占位、immutable input version/digest、purpose authz、
短时下载票据、provider allowlist，覆盖 3 个 REQ（001/002/019）。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 3 个 REQ 的 RED case 均有对应负例测试且全部通过，含最难的对象替换/跨租户/票据重放场景 | `ci_result/ci_summary.md` 命令表 | 已验证 | 否 |
| 已确认事实 | 首次实现时误用标准库 `xml.etree.ElementTree` 解析不可信上传内容，PostToolUse 安全钩子当场拦截（XXE/billion-laughs 风险），已改用正则提取，无完整 XML parser 攻击面 | `src/secure_ingest/ooxml_structure.py` | 已验证 | 否 |
| 已确认事实 | `backend/web/main.py` 与并行任务 `fix-ui-runtime-incident-20260722` 有共享未提交改动，已用 `git add -p` 精确只 stage 本变更的 2 个 hunk，未触碰并行任务的改动 | `git diff --cached`/`git diff` 分离确认 | 已验证 | 否 |
| 推测 | 无 | 不适用 | 不适用 | 不适用 |
| 未知问题 | alembic 包本身未在此沙盒环境安装（只有本地 `backend/alembic/` 目录同名遮蔽），迁移测试 skip；已确认既有 014 迁移测试同样 skip，非本次引入的环境缺口 | `pip show alembic` → not found | 不适用（后续独立会话有装 alembic 的真实环境时应绿） | 否 |

## 数据流与调用链

```
POST /api/secure-ingest/upload → MIME sniff → OOXML 结构检查(宏/zip-bomb) → 页数/大小阈值
  → 注入扫描(仅结构安全时) → sha256 摘要 → 落 var/(不落库字节) → SecureIngestArtifact 行
POST /{id}/ticket → purpose_authz 授权链 → 短时票据(仅存 token hash)
GET /download/{ticket_id} → 兑换时重新读盘算摘要比对(对象替换防线) → 单次使用 → 审计事件
provider_policy.assert_provider_allowed_for_body_access → 未声明字段一律拒绝出站
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `IngestArtifactV1`/`OcrStatus`/`RejectReason` | `backend/src/secure_ingest/schema.py` | 路由响应/OpenAPI | 21 项格式/攻击 fixture 测试 |
| `ProviderPolicyV1` | `backend/src/secure_ingest/provider_policy.py` + `backend/config/provider_policy.yaml` | provider 出站前置检查 | fail-closed 单测确认 |
| 3 张新表 | `backend/src/db/models.py` + `alembic/versions/017_secure_ingest_tables.py` | 路由层 | 字段逐一核对一致（迁移无法在此环境实跑，已静态核对） |

## 范围

3 个 REQ 对应的安全摄取 + 租户隔离实现，DOCX-only 首刀。

## 非目标

不做 PDF/扫描件/OCR（后续在同一 schema 扩展）；不做真 AV 引擎集成（明确排除 R0 范围，见测试
docstring）；不预先填入任何 provider 的真实合规值（OQ-06 已批准上线全 UNKNOWN）；不碰
`fix-ui-runtime-incident-20260722` 并行任务的任何文件。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 跨租户查询他人 artifact | 404（不是 403，不泄漏存在性） | `test_cross_tenant_status_lookup_denied` |
| 发票据后底层文件被替换 | 兑换时摘要不符，409 拒绝 | `test_object_substitution_digest_mismatch_denied_at_redemption` |
| 票据兑换第二次(重放) | 409 拒绝 | `test_ticket_single_use_replay_denied` |
| admin 角色任何情况下请求正文 | 默认拒绝，零例外 | `test_admin_role_denied_body_access_by_default` + 路由级同款 |
| provider 字段未完整声明 | 拒绝出站，不静默放行 | `test_provider_present_but_undeclared_fields_denied` |

## 风险与回滚边界

纯新增模块 + 1 个新路由 + 2 处基础设施小追加（main.py 2 行、models.py 3 个新类）。回滚：
`git revert` 摘除路由挂载即可下线整条摄取链路，不影响任何既有路由/契约；DB 层用
`alembic downgrade` 撤销新表（未在此环境实跑，逻辑已随迁移文件的 `downgrade()` 提供）。

## 计划确认记录

- 批准人：lyt（R0-W03 governance 批准 + AskUserQuestion 确认四项设计细节）
- 批准日期：2026-07-22
- 批准范围：R0-W03 实现（本变更全部内容）
- 明确未批准：R0-W04 及以后

## 验收标准

3 个 REQ 各自 RED case 有测试覆盖；backend/root doctor 0 错误；W02 与既有租户隔离测试零回归。

## 验证计划

见 `ci_result/ci_summary.md`。
