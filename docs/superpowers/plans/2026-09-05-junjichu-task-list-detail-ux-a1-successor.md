# 军机处任务列表与详情体验纠偏 A1：分阶段实施计划

## Status

DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION。

Task ID：`JUNJICHU-TASK-LIST-DETAIL-UX-A1-SUCCESSOR-20260905`
Base commit：`20594bbef826996314241c2b03005124ced7ee21`
Base tree：`ace83b6ceba0338b7d3ad739e47f7f308903fb0d`

当前仅治理候选，等待Owner精确批准。proposed JSON是未来正式approval的候选字节，其schema要求的APPROVED_FOR_ONE_CHILD不产生当前授权。本轮不运行本任务authorize、不物化.harness/approvals、不实施、不提交本包、不推送本包、不安装、不部署。

## 目标与取舍

保留CourtOS V2，在既有 /junjichu/scene-board 改善列表/详情、筛选、任务定位、错误反馈、窄屏与登录回跳。吸收cdesktop交互思路，不复制组件、CSS、Rust运行时、数据库、终端或工程审批接口。引用输入 /tmp/chaotang-workbench-absorption-candidate-20260905.md，sha256:f52321b9426a404d7fbe135e65d146d42ad387a7d6f1cb301bb79414b5b7daba。

铭硕exact4已在本基线落地，MFP合同与校验器保持不变；历史donor保留为证据，不借用其authority。原Stage A exact14（8 MODIFY+6 ADD）未施工，本包是新任务、新scope（9 MODIFY+5 ADD），不得因文件总数相同继承原身份。

## 精确范围

- MODIFY `frontend/src/app/junjichu/scene-board/page.tsx`
- MODIFY `frontend/src/features/pre-auth/formValidation.test.ts`
- MODIFY `frontend/src/features/pre-auth/formValidation.ts`
- MODIFY `frontend/src/features/scene-packs/SceneBoard.tsx`
- MODIFY `frontend/src/features/scene-packs/ScenePackWorkspace.tsx`
- MODIFY `frontend/src/features/scene-packs/client.ts`
- MODIFY `frontend/src/features/scene-packs/scenePacks.module.css`
- MODIFY `frontend/src/lib/requireUser.test.ts`
- MODIFY `frontend/src/lib/requireUser.ts`
- ADD `frontend/src/features/scene-packs/SceneBoard.test.ts`
- ADD `frontend/src/features/scene-packs/ScenePackWorkspace.test.ts`
- ADD `frontend/src/features/scene-packs/client.test.ts`
- ADD `frontend/src/features/scene-packs/sceneBoardController.test.ts`
- ADD `frontend/src/features/scene-packs/sceneBoardController.ts`

全部100644；第15路径立即STOP。未来approvalCommitPaths为：
- `.harness/approvals/JUNJICHU-TASK-LIST-DETAIL-UX-A1-SUCCESSOR-20260905.json`
- `docs/product/tasks/2026-09-05-junjichu-task-list-detail-ux-a1-successor.md`
- `docs/superpowers/plans/2026-09-05-junjichu-task-list-detail-ux-a1-successor.md`

三份草案仅保存在项目外审阅目录。将来正式物化前需要对Task/Plan目标路径保持字节、对proposed临时路径改为正式approval路径重新计算bundle，不沿用草案bundle；临时路径不得进入提交。

## 事实源与不变量

- SceneMission选中以missionId为准；从后端认证列表取得runId，读取SceneRun并核对runId/missionId/packSlug。owner展示字段是部门名，不是认证主体。无权/不存在统一不可查看，重复标识或错配不渲染。
- SceneRun由已有scene服务写入；BoardMission手动阶段由已有PATCH推进。正式decree_jobs与军机处cases是不同身份，不映射或冒充。不得创建第二账本。
- 列表无total字段，只显示“已加载N项、当前筛选M项”，不声明全系统总数。筛选分组可重叠，不累加。
- done只是看板记录阶段，completed只是生成状态；两者不代表用户验收/归档/报价批准。保留后端值，前端清楚区分，不修订业务状态机。
- 无SceneMission合法cancelled/取消接口，不移植decree_jobs取消。无产物下载或到期合同，不造下载/过期提示；dueAt只是任务提示日期。
- evidenceRefs只含既有来源文本；不把sourceLabel当URL，不外发。demo=false不表示事实已核验。

## 实施次序（每项均以未来独立授权为前提）

### P0：治理冻结，本轮唯一可交付项

1. 只读重核base/tree/主线、三份草案与新14路径存在性；9既有、5新增；MFP四路径零重叠。
2. strict JSON拒绝重复键；Draft2020-12 schema与validateApprovalManifest；Task八章节且Status首行Draft、productTaskErrors=[]；14验证命令、路径、non-goals的排序与唯一性。schema不通过就停，不伪造字段。
3. 计算Approval RFC8785 canonical、三文件raw SHA和bundle；独立Governance/TypeScript/Security仅审查草案，返回结论和剩余项。完整根Harness只证明当前主线；草案Task另行显式检查，不声称未落盘文件被主线Harness扫描。
4. 停止，等待Owner精确批准新canonical与未来动作。当前不存在产品GO。

### P1：未来正式approval与执行身份

Owner批准后才在最新精确匹配基线建立独立工作区、物化三文件，重新算正式bundle。依许可分别commit/普通快进；一次本任务machine authorize GO才实施。远端离开已冻结base时停止，不能替换base或恢复旧批准。

### P2：真实RED

在allowlist的test文件验证旧问题：错误/不带mission的导航、登录next丢失、陈旧列表对象、切换旧run可见、读取错误吞没、PATCH双击/拒绝/迟到、重复ID/响应错配、筛选计数与URL恢复、窄屏控件接线。新module缺失不算真实行为RED；必要时执行从绑定基线实际加载/提取的旧行为函数或观察实际旧页面，保留路径、行号、原始字节和失败断言。手写复刻的错误函数不算真实RED，源代码守卫不等于浏览器验证。

### P3：最小GREEN，一个写入者

1. sceneBoardController.ts仅纯解析/构造、状态转换和注入式请求协调；不得import server cookie、backend配置、React或默认发网络。每个页面实例独立创建控制器；模块顶层不保存任务、请求代次、PATCH或会话状态，认证模块仅调用无状态URL导出，加入双实例互不污染测试。既有client只修改看板GET/PATCH，其他调用保持兼容。
2. 同一URL解析器用于page、客户端与登录；只允许固定board路径、唯一mission/filter/panel。mission用既有opaque字符范围且严格拒绝空/超长；filter=all|awaiting|high|done，panel=list|detail。panel=detail但无mission时拒绝；panel=list携带合法mission时保留选择但不显示详情；省略panel时有mission规范为detail，否则为list。拒绝外部/协议相对URL、片段、重复/额外参数、畸形编码。保留原四个登录白名单目的地，不泛化任意站内跳转。
3. 明确无选择、列表加载/空/失败、详情加载/失败/无权/成功、PATCH在途/失败/未确认。刷新按ID重新关联；过时列表/详情/PATCH成功失败finally都不能写入当前视图。GET可中止，但不称业务取消；POST/PATCH不自动重放。
4. 发送端按钮仅改精准查看既有result任务；无合法mission、生成中、slug/demo不对应时禁用，不显示“已保存最新输入”。不处理整个Workspace生成、样例、证据锚点或其他原Stage A问题。
5. 首屏任务名、当前记录阶段、缺失/阻塞、已有摘要、下一步；技术ID折叠、次要手动阶段操作折叠。成功响应title必须为非空字符串，缺失/类型错/空白拒绝；通用“场景任务”仅用于加载或不可查看状态。PATCH blocked只改stage，文案不得称riskGrade已变。
6. CSS仅boardWorkspace范围；保留所有大殿strategyPanel/全局/Workspace共享样式，窄屏独立列表/详情和返回、焦点恢复。不得因共享CSS顺手改大殿。

### P4：完整验证与独立复审

每完整轮包含manifest14命令（下列id）、Task B01–B08浏览器步骤及范围/模式/clean检查；同一最终字节连续10轮，任何失败/实质字节变化停止并重新计数。独立三审基于最终字节，不能把设计审查沿用为代码审查。

- backend-scene-contract：cwd=backend，timeoutMs=300000
- diff-check：cwd=.，timeoutMs=180000
- frontend-build：cwd=frontend，timeoutMs=300000
- frontend-focused：cwd=frontend，timeoutMs=300000
- frontend-lint：cwd=frontend，timeoutMs=300000
- frontend-tests：cwd=frontend，timeoutMs=300000
- frontend-typecheck：cwd=frontend，timeoutMs=300000
- product-authority-regression：cwd=.，timeoutMs=180000
- root-doctor：cwd=.，timeoutMs=180000
- root-harness：cwd=.，timeoutMs=180000
- root-hook-self-test：cwd=.，timeoutMs=180000
- root-self-test：cwd=.，timeoutMs=180000
- v2-check：cwd=.，timeoutMs=180000
- v2-tests：cwd=.，timeoutMs=180000

精确可执行tool/args由proposed JSON冻结；Task同时列完整命令。仅进程级TMPDIR=/tmp（Python同时TEMP/TMP=/tmp），不改变Git/Python/Node系统配置。不自动安装依赖/浏览器框架。缺环境、超时或额外受跟踪构建输出均STOP，不跳过或放宽。

现有Playwright工具仅用于将来已授权非生产隔离账号/数据上的真实页面；本轮没运行。需要桌面与360px、真实请求身份、筛选、登录回跳、键盘、401/404/503、跨tenant拒绝、PATCH乱序与重复、共享视觉回归。正常链与故障注入证据分别标记，不以mock成功宣称真实业务通过。不点击真实模型、外发、发布、下载未知客户数据或交易。

机器consumer只核验其显式命令矩阵；浏览器截图/网络/console、人工语义和独立Review是额外硬门，全部完成才冻结候选。不会把14条CLI成功等同于真实浏览器/铭硕业务完成。

### P5：未来candidate收口

仅在另获候选commit/verify/push许可后创建approval直接单亲product child，精确14路径；机器verify PASS和全部人工硬门完成后才普通快进。任何机器STOP停止，不改authority或测试取得GO。本轮不执行P1–P5。

## 回滚与剩余工作

- A1无数据库变更。若将来落地，另行批准一条仅逆转A1前端变化的forward-only提交；保留铭硕及其他主线增量，不force、不reset、不删工作区、不改用户已保存任务阶段。回滚也需受影响回归与浏览器检查；本轮没有实际演练。
- 后继：原Stage A剩余Workspace纠偏→B诊断可信度/完成语义→C一个真实铭硕需求、证据化方案/有条件报价、修改、专业确认、下载和史馆归档→D反馈复用→E受限执行器对照。各包独立权限，不挪用A1。
- 当前无真实业务成功、ROI或生产资格证明，全部仍未测量；A1完成仅提高任务查看/跟进可用性。

## 停止条件与交付

漂移、machine STOP、三审P0–P2、关键验证失败、额外路径、需新状态/API/权限/依赖/外发、无法保持V2或无法证明回滚时STOP。

交付三草案及canonical/raw/bundle、范围、未验证事项和下一条精确治理授权；草案通过不等于产品通过，不自动推动后继。
