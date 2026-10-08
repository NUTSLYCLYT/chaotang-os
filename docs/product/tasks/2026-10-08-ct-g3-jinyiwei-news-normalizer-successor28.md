# 任务：锦衣卫离线新闻快照规范化与事件聚类（successor28）

## Status

Ready

## Product Definition

将已批准 Feed 的**离线快照**规范化为可审计的新闻条目与事件投影。该阶段只处理调用方提供的快照，不联网、不持久化、不把标题直接当作事实，也不绕过任何访问控制。

## Affected Modules

- 模块：锦衣卫离线新闻快照规范化、事件聚类、只读预览 API、同源 BFF 与案牍台展示。
- 允许路径：见 `.harness/approvals/CT-G3-JINYIWEI-NEWS-NORMALIZER-SUCCESSOR28-20261008.json` 的 `productPaths`。
- `backend/app/jinyiwei/news.py`：快照校验、规范化、内容哈希、确定性去重与事件聚类。
- `backend/app/api/jinyiwei.py` 与 `backend/app/jinyiwei/read_models.py`：受控预览 API 与严格读取合同。
- `frontend/src/app/api/jinyiwei/news/*`：同源、会话保护的 BFF。
- `frontend/src/features/jinyiwei-visual/JinyiweiNewsDesk.*` 与案牍台：展示原文元数据、来源指纹、事件聚类和冲突并列关系。

## Technical Plan

1. 只接受来源注册表中存在的 `source_id`，并验证快照 URL 属于该来源允许的 HTTPS host。
2. 对 RSS、Atom、JSON Feed 的已解析条目使用同一内部输入合同，保存标题、原文 URL、发布时间、更新时间、作者、发布机构、摘要和内容哈希。
3. 以规范化标题、发布机构和日期窗口生成确定性 `cluster_id`；同一内容只保留一次，冲突内容并列保留。
4. 输出只读 `NewsSnapshotPreviewRead`，包含条目、事件、来源指纹、拒绝原因和不得推断说明；不写数据库、不触发网络调用。
5. 前端只展示经过 BFF 的预览，明确标识“离线快照预览”，不允许把事件状态写入史馆。

## Delivery Constraints

- 只修改 manifest 指定的产品路径；审批文件和任务文档单独提交。
- 外网默认关闭；不得实现抓取、重定向跟随、定时任务、未知域名访问或登录绕过。
- 不使用模型生成事件结论；不从标题推导事实，不推断地理坐标。
- 不持久化新闻条目，不改变 ADR 0028、史馆采纳链路和只读案牍边界。
- 所有拒绝都返回稳定、脱敏的原因码。

## Acceptance Criteria

- [ ] 未注册来源、危险 URL、缺少发布时间或非法哈希的条目被拒绝。
- [ ] 相同内容的重复条目确定性去重，冲突条目并列保留。
- [ ] 相同输入快照与规则版本产生相同条目、事件和拒绝结果。
- [ ] 预览结果包含原文 URL、来源指纹、时间、内容哈希和不得推断说明。
- [ ] BFF 在无会话或带未知查询参数时不调用后端。
- [ ] 前端明确显示离线快照边界，不提供采集、编辑或史馆写入入口。
- [ ] 后端目标测试与前端 build/lint/test/typecheck 全部通过。

## Acceptance Review

- [ ] 未注册来源、危险 URL、缺少发布时间或非法哈希的条目被拒绝。
- [ ] 相同内容的重复条目确定性去重，冲突条目并列保留。
- [ ] 相同输入快照与规则版本产生相同条目、事件和拒绝结果。
- [ ] 预览结果包含原文 URL、来源指纹、时间、内容哈希和不得推断说明。
- [ ] BFF 在无会话或带未知查询参数时不调用后端。
- [ ] 前端明确显示离线快照边界，不提供采集、编辑或史馆写入入口。
- [ ] 后端目标测试与前端 build/lint/test/typecheck 全部通过。

## Implementation Report

- 改动摘要：Pending
- 验证：Pending
- 剩余风险：真实 Feed 抓取、许可核验、长期监控和新闻实体解析需另行审批。
