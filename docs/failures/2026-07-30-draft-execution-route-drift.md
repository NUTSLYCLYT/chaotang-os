# 拟旨与正式执行路由漂移

## Summary

拟旨阶段向用户展示的参与部门没有进入一次性授权，正式下旨又根据自然语言重新推断部门；同时拟旨结构允许把“户部会计司”混写成部门，导致用户批准的组织、正式执行部门和司级承办路径无法逐项对齐。首次源码修复后，8000 端口仍运行前一日启动且未开启热重载的旧进程，用户实际看到的路径仍进入军机处、礼部、工部和锦衣卫，而测试因同时伪造授权与执行图错误报告全绿。

## Root Cause

授权契约只绑定 owner、版本、指纹和正文，没有绑定由服务端验证并规范化的部门/必选司快照，所以“用户批准了谁办理”不是授权事实。正式丞相图仍拥有重新选择部门的权力，拟旨结果与执行输入之间不存在不可变的数据流约束。另一方面，拟旨模型只有自由文本 `department`，缺少独立、强类型且受六部/39司名录约束的 `bureaus` 字段，使部级身份和司级能力被压入同一个字符串。

第一次修复还留下两个独立根因：批准的司只作为“必选子集”，模型仍可追加其他司；HTTP 边界只检查路径为非空字符串数组，没有验证路径与批准路由一致。运行态方面，验证只执行测试进程中的新源码，没有核对实际监听服务的启动时间和加载版本；合成财务验收又直接替换了正式图和 authority consume，无法发现旧进程、真实图或路径拼装漂移。

## Prevention

- 用 typed `department` / `bureaus` 建模：部门必须来自六部名录，必选司非空、无重复、有序且属于对应部门，财务场景固定为 `户部` / `会计司`。
- 将规范化路由快照加入 fingerprint，并在 `DRAFT_READY` 时随一次性 authority 一并登记；正式 API 原子消费并取得该不可变快照，浏览器不能提交或重建 route。
- 正式 graph 先验证快照，再直接锁定批准部门及顺序；路由模型、确定性规则和行情规范化都不得新增、删除、替换或重排部门。
- ministry 在任何司级调用、Excel 产物和归档副作用之前校验全部必选司；首次遗漏只允许一次不回显原响应的固定纠正，连续两次遗漏必须失败关闭。
- 财务报表旨意使用精确司集合而非必选子集：只允许会计司；会计司使用确定性报表会话，不接收锦衣卫证据调查会话。
- 正式 API 对财务报表结果校验完整路径，任何军机处、锦衣卫、其他部门或额外户部司都在归档和发布前失败。
- 部署或本地运行验证必须核对监听进程启动时间晚于相关源码，并在无热重载时主动重启；重启后旧内存授权失效，必须重新拟旨。

## Detection

以真实财务跨层回归覆盖“authority snapshot → 正式 graph → 户部·会计司 → 可下载 Excel → 史馆回奏”，对用户完整原旨意断言处理路径精确等于“上书房 → 丞相首次分流 → 户部 → 户部·会计司 → 户部部级补充 → 丞相最终汇总”，并断言 `single`、无军机处结论。契约测试覆盖军机处、锦衣卫、礼部、工部及额外户部司注入，所有情况都必须返回脱敏 502 且归档次数为零。

失败路径必须明确计数副作用为零：无效快照要在 report session、部级调用和军机处开案前失败；必选司连续两次遗漏时，司级调用、Excel artifact、军机处案件和史馆归档均为零。全量后端/前端测试、四条 harness 与 `git diff --check` 共同防止局部测试假绿和治理基线漂移。

## Evidence

- [批准路由设计](../superpowers/specs/2026-07-30-approved-draft-routing-design.md)
- [批准路由实施计划](../superpowers/plans/2026-07-30-approved-draft-routing.md)
- [财务报表精确路由设计](../superpowers/specs/2026-07-30-exact-accounting-decree-route-design.md)
- [财务报表精确路由计划](../superpowers/plans/2026-07-30-exact-accounting-decree-route.md)
- [ADR 0028：旨意—证据流治理基线](../decisions/0028-decree-evidence-flow-governance-baseline.md)
- [路由快照模型与校验](../../backend/app/agents/chancellor_draft/routing.py)
- [正式丞相图批准路由入口](../../backend/app/agents/chancellor/graph.py)
- [部内必选司门禁](../../backend/app/agents/ministries/agent.py)
- [真实财务跨层测试](../../backend/tests/test_accounting_report_cross_layer.py)
- [部内选司失败副作用测试](../../backend/tests/test_ministries_agent.py)
- [正式下旨 API 失败边界测试](../../backend/tests/test_decrees_api.py)
