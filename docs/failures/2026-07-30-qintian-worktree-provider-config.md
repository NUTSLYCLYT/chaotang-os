# 钦天监 worktree 缺少模型运行时配置

## Summary

钦天监前后端离线测试全部通过，但新 worktree 启动时先后遗漏了真实 provider 配置与
端到端模型延迟预算。用户实际问询只能收到模型或服务暂不可用的安全降级提示。

## Root Cause

功能验收只覆盖了可注入 fake provider 的离线测试和 HTTP 错误映射，没有把新 worktree
的私有 provider 配置与真实启动进程纳入运行验收。后端由系统 Python 直接启动，当前
worktree 没有私有 dotenv 文件，启动进程也没有继承 provider 环境变量，因此真实调用在
发起网络请求前按设计失败。补齐配置后，验收又只直调 provider，没有经过浏览器和 BFF；
钦天监后端客户端仍复用了健康检查的 3 秒超时，而真实模型通常需要十余秒，导致 BFF 主动
中止请求并返回 503。前端正确显示了降级提示，但此前的“全部测试通过”和 provider 直调
均不能证明浏览器端到端能力可用。

## Prevention

启动包含真实模型能力的新 worktree 时，先执行脱敏的 DeepSeek 配置检查，再启动后端；
启动脚本必须显式从用户指定的私有配置源向子进程注入环境变量，不得依赖调用终端的偶然
环境，也不得复制、打印或提交密钥。模型调用必须使用独立于健康检查的超时预算。产品验收
应把“离线契约通过”“真实 provider 可用”和“浏览器经 BFF 获得真实回复”列为三项独立
证据。

## Detection

使用 `python -m app.langgraph_runtime.deepseek_check --dotenv-path <用户明确指定的私有配置>`
检测配置解析和客户端构造；需要交付真实模型能力时，再执行一次最小真实问询，只记录响应
非空和服务健康状态，不记录密钥。最后必须从登录页面提交一次真实问询，并同时确认 BFF
返回 200、后端收到 POST、页面渲染助手消息。`node scripts/check_harness.mjs` 用于校验本记录
结构，但不会替代真实 provider 与端到端检查。

## Evidence

- `backend/app/qintianjian/provider.py`
- `backend/app/langgraph_runtime/deepseek_check.py`
- `backend/config/providers.yaml`
- `frontend/src/app/api/qintianjian/routeSupport.ts`
- `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`
