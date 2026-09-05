# 军机处 V4 × A1 任务体验融合

## Status

Draft

## Product Definition

Owner 于本轮要求融合更好的 V4 页面，之后再试用。目标是以已落地 A1 的真实场景任务接口为底座，吸收 V4 的深青黑金色、纸卷内容层、三栏工作台与信息层级。源为三张设计图及按钮说明，不是待合并代码分支。遵守 docs/decisions/0028-decree-evidence-flow-governance-baseline.md；正式下旨和业务确认仍在上书房。

非目标：本包不实现铭硕报价、认证前置、真实协作拓扑、甘特排期、消息系统、跨项目全局搜索、文件下载或正式成果确认。完整 V4 交互保留在后续清单，不把本包冒充全量 V4。

## Acceptance Criteria

- [ ] 桌面呈现左任务案卷、中任务概览与现有结果、右缺失/风险/下一步；以当前选中 mission/run 为唯一上下文。
- [ ] 深青黑底、哑金边界、暖纸色正文；沿用现有字体与可用本地资产，不增加字体下载、图片库或运行时。
- [ ] 概览与结果切换只改变本地展示，不新增URL参数、不改变原查询闭合合同；任务切换清空旧展示上下文。
- [ ] 数量明确标记“已加载任务”；不将分页数量当全项目总数，不将 confidence 转成完成进度。
- [ ] 中央展示 summaryForUser/verdictText/evidenceRefs，右栏展示 missingItems/nextActions；空字段显示缺失而不推断审批、责任人或依赖。
- [ ] 当前契约没有可信下载地址、成果版本、待验收计数、排期或依赖图；这些按钮不可执行并说明未接入，不提供伪下载、不将 details 任意对象当可信成果。
- [ ] 原生成状态与手动看板阶段继续分开；手动阶段不叫成果验收。军机处不能直接确认成果、暂停正式旨意或重新派单。
- [ ] 360/768/1440像素下可操作，200%缩放、键盘、焦点、减弱动画、长中文及错误状态可用。窄屏不得隐藏无法找回的阻塞详情。
- [ ] A1登录返回、无权清旧数据、过期、身份三元绑定、旧请求抑制、单飞与未知写入不重试全部保持。

## Delivery Constraints

Codex-only。仅展示适配；不改全局CSS、旧scenePacks.module.css、controller、client、auth、API、LangGraph、后端或依赖锁。使用独立模块CSS，无全局选择器。不得迁入cdesktop运行时或覆盖frontend目录。用户总体授权不替代仓库要求的准确approval摘要与机器GO。本文件是正式实施包的提案，尚无产品实施权。proposed approval中APPROVED_FOR_ONE_CHILD是schema要求的未来状态，不是当前批准或machine GO。正式approval必须与Owner精确确认的canonical摘要相同，先落地且机器GO后才可修改产品。

## Affected Modules

- 模块：军机处现有 SceneBoard 任务展示
- 允许路径：frontend/src/features/scene-packs/SceneBoard.test.ts、frontend/src/features/scene-packs/SceneBoard.tsx、frontend/src/features/scene-packs/SceneBoardV4.module.css、frontend/src/features/scene-packs/sceneBoardV4Presentation.test.ts、frontend/src/features/scene-packs/sceneBoardV4Presentation.ts；3 ADD + 2 MODIFY；全部100644。
- 依赖模块：A1 controller/client/types只读复用，BFF/后端保持原样。

## Technical Plan

新增纯展示映射和测试、隔离V4样式；在既有SceneBoard重新编排展示，不复制controller或网络逻辑。按钮分为可执行、只读切换、未接入；不得挂空点击造成成功假象。刷新仍只读，正式处理最多保留普通“前往上书房”导航；无正式decree身份不得声称精确定位同一旨意。首批使用原路由，不重定向/junjichu旧案卷入口。

先冻结新manifest与基线，再新增真实失败测试，再最小实现；浏览器先跑A1关键链及V4桌面/窄屏/错误/焦点验收。缺能力的完整V4按钮后续各自依据真实API接入，不阻塞本次展示融合。

## Implementation Report

本轮仅设计；没有产品修改、新RED/GREEN或V4浏览器验收。已读A1源码、V4图片与交互规格；实时远端观察为96c70e3128b833fdb343499b1ecf6d254da5f7c4，工作树clean。技能：frontend-design用于视觉吸收；项目工程路由要求GOVERNED，缺少专用Superpowers工具时使用等价原生设计/基线/验证/独立审查步骤。不迁移已拒绝donor权限身份。

## Acceptance Review

正式提案独立审查待完成；此前设计草案GO仅适用于草案，不继承本提案批准或产品验收。不可宣称V4已可测试。机器STOP、基线漂移、第六路径、A1回归、危险按钮或任一P0–P2立即停止。

## Frozen proposal identity

观察/请求基线：96c70e3128b833fdb343499b1ecf6d254da5f7c4 / tree e57dbb043643bbcceb4a0eeba45382a221aa29e7。approvalCommitPaths精确为.harness/approvals/JUNJICHU-V4-A1-EXPERIENCE-SUCCESSOR-20260905.json、docs/product/tasks/2026-09-05-junjichu-v4-a1-experience-successor.md、docs/superpowers/plans/2026-09-05-junjichu-v4-a1-experience-successor.md。仅在远端仍等于该基线时允许后续精确授权；漂移必须STOP，不能重新锚定旧包。审批三文件不含packet草案或proposed临时路径。
