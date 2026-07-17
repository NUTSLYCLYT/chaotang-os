# 预览 / 部署报告

结论：P8 PREVIEW PASS；CUMULATIVE SMOKE PASS

## URL

- 前端 `http://127.0.0.1:3002/chaotang/liubu`
- 临时后端 `http://127.0.0.1:8082/api/guoli/overview`

## 检查

- 前端仅使用 3002；未占用禁用 3001，也未干扰现有 3050。
- 后端读取 P8 worktree 的空 truth ledger，返回真实 NO_DATA；认证关闭仅用于本机预览。
- DB 使用 `/tmp/p8-guoli-fengqun.db` 副本并关闭 lifespan，原因是副本 schema 014 而 P7 head 为 016；未迁移或写生产库。
- 浏览器 console 在 P8 页面只有 DevTools/HMR 日志，无 P8 错误。
- API/UI response 同轮对照、截图与视觉检查通过。
- 因 3002 被独立 P9 工作树占用，累计 smoke 使用临时隔离前端端口 3012；未停止或干扰 P9 服务。
- 临时后端 8082 只写 `/tmp/p8-guoli-fengqun-*.db` 副本；canonical POST 返回 200。

## 剩余风险

- 真实环境当前无御史样本，因此浏览器只实证 NO_DATA；LIVE 由真实生产写入路径 pytest 与 node 契约测试覆盖。
- 真实环境当前仍需独立 Packet review 后才可合并/发布；本报告不宣称已部署。
