# 规格说明：feat-ext-d4a-docx-provenance-20260812

## 背景

现有上传入口仅读取 `document.paragraphs`，遗漏表格、页眉页脚、批注、脚注及删除修订中的文本，
导致安全扫描和后续来源链看到的文本面不完整。D4A donor 有完整但过大的实现，本包只重建文本提取纵切。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | upload 使用 `document.paragraphs` | `backend/web/routers/secure_ingest.py` | 已验证 | 是 |
| 已确认事实 | D4A 整包 2908 行且跨多个事实源 | donor `00d2b5ae` | 已验证 | 是，禁止整包移植 |
| 已确认事实 | 当前 R0-W08 v2 权威 GO | authority command | 已验证 | 否 |

## 数据流与调用链

DOCX bytes -> OOXML 结构门 -> canonical story extraction -> injection scan -> ACCEPTED/REJECTED。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| canonical DOCX text | `document_text.py` | secure-ingest upload | fixed policy version + focused tests |

## 范围

仅新增规范 DOCX 文本提取并接入现有 upload 安全扫描。

## 非目标

不修改数据库、idempotency、ticket、FinalMemorial 或前端契约；这些另包处理。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 隐藏在删除修订/批注的注入文本 | 纳入扫描面 | focused tests |
| 表格/页眉页脚证据 | 保持稳定顺序提取 | focused tests |
| 任意 OOXML 附件 | 不扩大信任面，仅明确 allowlist | implementation review |

## 风险与回滚边界

主要风险是重复 story、任意 XML part 扩大扫描面和恶意包解析。上游 OOXML 结构检查仍先于文本提取；
辅助 part 只允许 comments/footnotes/endnotes。回滚只需恢复 router 三行并删除新模块/测试。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-08-12
- 批准范围：D4A 能力+契约+测试式吸收
- 明确未批准：整枝合并、旧治理/迁移/审批

## 验收标准

focused tests 全绿；现有 upload 安全测试不回归；authority/doctor/matrix/全量通过；独立审查无 HIGH/MEDIUM。

## 验证计划

先 focused 3 tests，再 secure-ingest 相关测试，最后项目门禁和全量回归。
