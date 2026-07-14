# Step 0 数据治理硬门

状态：`BLOCKED_FOR_REAL_CUSTOMER_DATA`。在本文件所有生产数据门完成前，只允许合成或不可逆匿名材料；不得上传真实客户合同，不得把本机/开发数据当作授权样本。

## 1. 证据范围与 owner 规则

- 证据时间：2026-07-14。
- 证据仅来自仓库静态代码/文档与本机文件元数据；未读取 secret、客户正文或业务数据库行。
- 角色 ID 不是实名签字。provider、迁移、上传/下载、删除、备份各门必须绑定有权限的自然人 owner、授权范围、时间和 approval record。
- 数据治理结论不得由生成法律结论的同一 Agent 自批；Release Commander 只消费批准结果，不修改标签或政策迎合候选版本。

## 2. 治理门矩阵

| Gate | 状态 | 待绑定 Owner | 证据时间与命令/来源 | 结论 | blocks_steps |
| --- | --- | --- | --- | --- | --- |
| G1 客户材料授权 | `BLOCKED_OWNER_AND_EVIDENCE` | Data Privacy + Legal Owner | 产品/威胁模型/黄金资产规则 | 未找到实名授权人、用途、允许模型处理、保存期、退出/删除和再利用批准记录 | Step 7B；Launch S6–S10 |
| G2 provider retention/training/region | `BLOCKED_EXTERNAL_POLICY` | Data Governance + Security + Legal Owner | `backend/config/providers.yaml`、provider 代码；未读 secret | 存在外部 API 与本地路由配置，但无政策版本、retention、训练使用、数据驻留/DPA 字段；不能从 provider 名称推断 | Step 5/7/12；Launch S6/S8–S10 |
| G3 tenant/对象归属 | `CONFIRMED_GAP + BLOCKED_PRODUCTION` | Database Migration + Source Data Owners | migration、repository、P0-B 行为测试 | 多处仍有默认 tenant/anonymous sentinel；生产映射、孤儿量和 quarantine 未取证。无法可靠归属必须 fail closed，禁止默认 tenant 回填 | Step 1A–1C |
| G4 上传安全 | `CONFIRMED_GAP` | Application Security Owner | knowledge/IMA upload route/store 扫描 | 旧 knowledge upload 已 fail closed；活跃 IMA 文本上传缺服务端大小/MIME、恶意文件、tenant/对象授权、去标识和 prompt-injection 门，且全局目录可能同名覆盖 | Step 5/9/12；Launch S6.2/S8/S9 |
| G5 下载/导出授权 | `PARTIAL_LOCAL + BLOCKED` | Application Security + Data Privacy Owner | `backend/web/routers/exports.py`、auth deps | 有登录和基本路径校验，但缺 run owner/对象授权、用途、审计、过期/撤销；可导出 prompt/output/final 内容 | Step 1B/9/12；Launch S8–S10 |
| G6 日志/trace 脱敏 | `CONFIRMED_GAP` | Observability + Data Privacy Owner | step log、production events 扫描 | 可持久化完整 input、rendered context、system prompt、raw output；task preview 也可能含正文片段，未见统一写前脱敏/retention | Step 5/8/12；Launch S8–S10 |
| G7 retention/deletion/legal hold | `BLOCKED_SYSTEMWIDE` | Data Privacy + Legal Owner | IMA archive/build-ledger/知识飞轮设计 | IMA archive 只移动文件且不删已索引 chunks；局部 90 天规则不能推广到合同、日志、向量、导出与备份；无系统 DeletionRequest/证据 | Step 11/12；Launch S8–S10 |
| G8 业务备份与恢复后删除 | `ABSENT/NO_DRILL` | Database/SRE + Data Privacy Owner | restore/backup 全仓扫描 | `system-restore.sh` 仅服务恢复；无业务备份、加密、schedule、RPO/RTO、空机恢复或恢复后单客户删除演练 | Step 12；Launch S8/S10 |
| G9 上传内容进入 Git | `CONFIRMED_RISK` | Repository/Data Governance Owner | IMA store 路径与 `.gitignore` | `backend/knowledge/docs/ima_uploads/`、`ima_archived/` 未见明确 ignore；当前未证明已有客户正文被提交，但必须先封闭路径 | Step 9/12；Launch S8/S9 |
| G10 生产鉴权开关 | `BLOCKED_PRODUCTION` | Security + Release Owner | auth dependency、`prod:doctor` | 代码允许配置鉴权；本机 doctor 同时报告 JWT key id 缺失，未获不可绕过的生产配置证明 | Step 1B/12；Launch S5/S9/S10 |
| G11 黄金集授权/泄漏 | `BLOCKED_FOR_REAL_DATA` | Legal Evaluation + Data Privacy Owner | `golden-assets-plan.md`、quality rubric | 只允许合成/不可逆脱敏；没有实名双人 reviewer、仲裁、授权和 label approval，现有样例不能当生产客户授权 | Step 7B/7C/12 |

## 3. 真实数据准入的最小证明

任何真实客户材料进入候选环境前，以下必须全部有可复验 approval record：

1. 客户/数据控制方书面授权：tenant、用途、可访问角色、模型处理、保存期、退出/删除、导出和再利用。
2. provider 政策快照：provider/model、policy version、retention、training use、region、subprocessor、DPA 和批准人。
3. tenant 与对象级授权：上传、查看、状态、裁决、导出、归档和删除均有正反行为证据。
4. 上传隔离：类型/大小/页数、宏/恶意文件/压缩炸弹、路径穿越、病毒、SSRF、间接 prompt injection 与解析失败恢复。
5. 脱敏与最小化：prompt、日志、trace、fixture、截图、导出、错误和观测都不能泄露正文或身份。
6. 删除闭环：主库、对象存储、文件、向量、缓存、导出、日志和可删除备份均有删除/补偿证据；legal hold 单独裁决。
7. 备份恢复：加密备份、空机恢复、schema/count/hash/权限对账、实测 RPO/RTO，并证明恢复后删除队列可重放。

## 4. 当前允许与禁止

允许：合成合同、不可逆脱敏且授权范围明确的仓内样例、隔离 tenant、stub/local provider、只读静态扫描、无客户正文的 schema/fixture 设计。

禁止：真实客户合同、生产 credential、未批准外部 provider、关闭 auth/tenant 门、把 IMA/日志/导出当安全存储、把 local health/NO_DATA 当生产合规、把角色名当实名批准、将客户原文直接加入 Git/黄金集/知识库。

## 5. Task 7 数据侧结论

数据治理产物已形成，但 G1–G11 没有全部通过，Task 7 只能标 `DOC_COMPLETE_WITH_BLOCKERS`。这些 blocker 直接阻断真实客户数据、Step 1A–1C 的生产迁移设计、Step 7B/7C 质量门和 Step 12 发布；Task 8 只能记录动态基线，不能将其改写为生产 READY。
