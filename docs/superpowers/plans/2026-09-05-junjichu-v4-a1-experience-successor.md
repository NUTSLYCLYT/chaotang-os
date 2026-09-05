# V4 × A1 实施与验收计划

## Status

DRAFT / NON_AUTHORIZING

## Sequence

1. 以本轮已读的96c70e3为观察身份；正式批准前重新确认实际远端和精确五路径，不re-anchor旧A1。
2. 新approval三文件冻结/明确摘要确认/普通快进/machine GO 后才实施。
3. 在纯展示测试内先证明缺失行为RED。不能把已有A1测试或HTTP200冒充新增视觉RED/GREEN。
4. 加入隔离样式与展示映射，接回同一个A1 controller；不新增事实、控制流程和写API。
5. 验证后独立Governance/TypeScript/Security审查；再走单亲候选/机器验证/具体Git授权。
6. 确认合格新构建后另用非生产端口试用；保留现有18366作回退，不中断铭硕工作区。

## Negative cases

无selected/run、身份不符、乱序响应、401/403/404/503、未知写入结果、重复点击；未知状态、空证据、DEMO与非DEMO、done不等于批准；不可信details中的URL/HTML/假下载；极长文本；切换任务时视图不泄露旧内容。没有可靠成果时必须显示未接入，不用假数据填满设计图。

## Verification design

- cd frontend && node --test src/features/scene-packs/sceneBoardV4Presentation.test.ts src/features/scene-packs/SceneBoard.test.ts src/features/scene-packs/sceneBoardController.test.ts src/features/scene-packs/client.test.ts src/features/scene-packs/ScenePackWorkspace.test.ts src/features/pre-auth/formValidation.test.ts src/lib/requireUser.test.ts
- cd frontend && npm test
- cd frontend && npm run lint
- cd frontend && npm run typecheck
- cd frontend && npm run build
- cd backend && TMPDIR=/tmp TEMP=/tmp TMP=/tmp python3 -m pytest -q tests/test_scene_pack_api.py
- node scripts/check_harness.mjs
- node scripts/check_harness.mjs --self-test
- node scripts/harness-doctor.mjs --check
- node .agents/hooks/check-harness.mjs --self-test
- TMPDIR=/tmp node --test scripts/product-authority.test.mjs
- node scripts/ext-full-value-convergence.mjs --check
- node --test scripts/ext-full-value-convergence.test.mjs
- git diff --check

正式manifest前机械核对测试路径存在与选择器，不改变门槛。浏览器使用合成账号、真实认证/场景接口，完成登录→生成示例→打开同一任务→三个区域核对→切换→刷新→退出重登；记录1440/768/360截图、200%缩放、键盘焦点、预期故障与未捕获错误。A1旧证据仅回归基线，不继承V4通过。

## Rollback

未提交候选保留，切回旧合格试用服务；若未来已落地主线则新建经批准的正向回滚提交，不reset主线、不删除donor。无数据库变化。本轮无实际rollback或产品测试。

## Proposal matrix binding

以本包proposed approval的14项命令为精确机器矩阵；浏览器矩阵为额外必须的验收证据，不得以machine PASS替代。candidate必须精确3ADD+2MOD、全部100644。浏览器用隔离合成环境，不迁入原型运行时、不调用真实模型，不将原图进度/通知/角色状态搬入事实。冻结完成后保留候选，Git动作遵守具体身份确认。
