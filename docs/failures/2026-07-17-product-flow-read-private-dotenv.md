# Product-flow 默认检查误读私有 dotenv

## Summary

2026-07-17 的“完成后端环境配置闭环”自动交付中，模块角色运行了未带安全覆盖路径的
`python -m app.langgraph_runtime.deepseek_check`。该命令在进程环境没有 Key 时按新实现的默认
fallback 读取了用户私有、Git 忽略的 `backend/.env.example`，违反了产品任务中“自动交付全过程
不得读取该文件”的硬约束。

命令没有调用模型或访问网络，控制台只输出通用成功状态。事后脱敏扫描确认候选仓库文件和本次
product-flow JSONL 都没有出现真实 Key 形态，当前进程环境也未被污染；但读取行为本身已经构成
隐私边界失守，任务不得据此验收通过。

## Root Cause

- 生产设计允许默认检查命令读取私有 dotenv，而自动交付约束又禁止交付过程读取同一默认路径；
  两者依赖“执行者记得传安全临时路径”才能兼容，缺少程序化隔离。
- pytest 的 autouse fixture 只保护测试进程，不能阻止模块角色在测试之外直接运行默认 CLI。
- 交付提示说明了禁止读取私有文件，却没有把允许的 smoke 命令精确限定为“必须显式传入临时
  dotenv 路径”，模块角色因此把生产默认命令当作普通零网络 smoke。
- 实时日志脱敏只能避免输出泄露，不能防止进程在内存中读取本地秘密。

## Prevention

- 配置检查 CLI 必须默认拒绝读取私有 fallback；只有显式传入 `--dotenv-path <临时或私有路径>`
  或显式的本地用户确认开关后才允许读取。自动交付验证一律使用临时文件和假值。
- 为 CLI 增加回归测试：无显式路径时不得调用 dotenv parser；传临时路径时可完成零网络检查；
  任何输出均不得包含假 Key 标记。
- product-flow 产品任务涉及私有默认路径时，Delivery Constraints 和模块角色提示必须列出精确
  允许命令，禁止运行会隐式回退到私有路径的默认 smoke。
- 不得用“没有打印 Key”替代“没有读取 Key”的验收；两者必须作为独立标准验证。

## Detection

- 在 `backend/tests/test_deepseek_check.py` 中用 mock 断言未显式授权默认私有路径时
  `dotenv_values` 从未被调用，并断言显式临时路径的成功/失败分支。
- 在 `scripts/check_harness.mjs` 中检查配置检查入口包含显式 dotenv 路径参数与默认拒绝私有读取
  的保护文本，防止后续删除防线。
- 自动交付结束后扫描本次 product-flow JSONL：若出现不带安全路径参数的
  `deepseek_check` 命令，则验收失败；同时继续做只输出命中数量的凭据形态扫描。
- 人工验收必须核对命令证据，而不能只看 pytest/ruff/harness 的绿色退出码。

## Evidence

- 产品任务：`docs/product/tasks/2026-07-17-complete-backend-environment-config.md`
- 触发读取的检查入口：`backend/app/langgraph_runtime/deepseek_check.py`
- 默认 fallback 实现：`backend/app/langgraph_runtime/deepseek_env.py`
- 自动测试隔离：`backend/tests/conftest.py`
- 协作与隐私停止条件：`.agents/skills/product-flow/SKILL.md`、`docs/product-collaboration.md`
