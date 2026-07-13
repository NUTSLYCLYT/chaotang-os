# 规格说明：fix-system-restore-dry-run-health-20260714

## 背景

`frontend/scripts/system-restore.sh --dry-run` 原实现让 `wait_healthy` 直接返回成功，且端口速查把 `ss` 的输出顺序写反。在 unit 已注册但 inactive、端点全挂的隔离场景中，命令仍 exit 0 并打印“全部服务恢复正常”；真实环境则出现 HTTP 健康但四端口全部误报“未监听”的自相矛盾证据。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | dry-run 跳过所有 `wait_healthy` HTTP 探测 | `frontend/scripts/system-restore.sh` 修复前实现；新测试首轮 1 failed | 隔离 PATH 复现 | 是 |
| 已确认事实 | `ss` 输出顺序是 `LISTEN ... :port`，旧规则按 `:port ... LISTEN` 匹配 | 实际 dry-run 四端口误报；新测试第二轮 1 failed | 真实运行 + fake `ss` | 是 |
| 推测 | 无 | 不适用 | 不适用 | 否 |
| 未知问题 | systemd unit 与当前手动进程的长期归属仍未统一 | S3 生产拓扑阶段 | prod identity/commander 验证 | 否，不属于本闭环 |

## 数据流与调用链

`CLI --dry-run -> systemctl 只读状态 -> 单次 curl 端点探测 -> FAIL 累计 -> exit 0/1 -> ss 端口速查`。dry-run 不调用 restart、不 sleep 重试；正常恢复模式保持原重启/重试链。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| dry-run 退出码 | `system-restore.sh` | operator/self-healing monitor | 所有必需端点健康为 0；任一失败为 1 |
| dry-run 副作用 | `maybe_restart` | systemd services | 禁止 restart；隔离 fake systemctl 断言 |
| 端口证据 | Linux `ss -tlnp` | 人类汇总 | 匹配 `LISTEN ... :port`；fake 与真实输出验证 |

## 范围

- dry-run 对 LiteLLM、legal-agent、jiqun、nginx 通路和 courtos-web 执行只读健康探测。
- 修正端口 LISTEN 匹配。
- 新增隔离 Node 回归测试和两层 change record。

## 非目标

- 不接管 3050，不重启服务，不创建 immutable build。
- 不改变正常恢复模式的 restart/重试策略。
- 不解决 unit 注册、外部 trust anchor 或生产 READY。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| unit inactive、端点全挂 | 不 restart；汇总异常；exit 非 0 | 新测试 case 1 |
| unit inactive、手动端点健康 | 不 restart；exit 0 | 新测试 case 2 |
| HTTP 健康且端口 LISTEN | 不显示“未监听” | 新测试 case 2 + 实际 dry-run |
| courtos-web unit active 但 HTTP 失败 | dry-run 必须计失败 | `wait_healthy` 在 active 分支执行 |
| 正常恢复模式 | 保持原重启和重试 | diff review + shell syntax |

## 风险与回滚边界

仅修改一个恢复脚本并新增测试/记录。回滚会重新引入假绿，因此若需回滚应整体 revert 本提交；没有数据库、进程或端口状态写入。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-14
- 批准范围：继续执行蓝图中的下一最小闭环
- 明确未批准：服务接管、部署、推送远端

## 验收标准

- 新测试先 RED 后 GREEN。
- unhealthy dry-run 非零且不打印全部正常。
- healthy dry-run 为零、端口证据正确、没有 restart。
- 实际 dry-run、doctor、S1 回归、shell syntax、diff/secret 检查通过。

## 验证计划

- `node --test frontend/scripts/system-restore.nodetest.mjs`
- `bash -n frontend/scripts/system-restore.sh`
- `cd frontend && bash scripts/system-restore.sh --dry-run`
- `node --test scripts/operational-source-paths.nodetest.mjs`
- 根/前端 doctor、diff/security review。
