# DeepSeek 双重 preflight 缺口导致生成故障假绿

## Summary

本次事故暴露了两个相互独立的 preflight 缺口：历史配置的 `deepseek-chat` 已退役或不再被当前
账号的 `/models` 目录公开，必须刷新为已公开模型；刷新后，当前模型的最小 Chat Completions
请求仍被 provider 以 HTTP 402 拒绝。模型目录漂移本身并未被证明是用户可见 502 的原因；当前
生成失败的直接证据指向账号/provider 的生成资格门禁。

## Root Cause

健康检查和 mock 测试只证明本地服务与离线契约，没有检查两个必要且互不替代的外部条件：配置
模型是否仍在认证后的模型目录中，以及该账号是否有资格对该模型执行生成。最初的旧进程诊断
不足以解释任一外部门禁；随后 `/models` 成功也只能闭合模型发现能力，不能证明生成资格。

历史 `deepseek-chat` 未出现在当时仅含 `deepseek-v4-flash`、`deepseek-v4-pro` 的认证目录中，
因此配置刷新是必要修复，但不能据此把 live 502 归因于目录漂移。刷新后对当前模型进行的单次
直接 Chat Completions 诊断返回脱敏的 `APIStatusError`：HTTP 402、code
`invalid_request_error`、type `unknown_error`，且未重试。这把当前用户可见生成失败定位到
账号/provider 的生成 entitlement/billing/balance/quota 门禁。由于诊断刻意没有查看或记录
provider 的消息与响应正文，余额不足、计费状态、额度或其他商业限制中的确切子原因仍未确认，
不得进一步猜测。

## Prevention

- 发布前必须分别通过“模型目录可用性”和“最小生成资格”两道 preflight；前者通过不代表后者通过。
- 模型配置刷新必须基于获授权的实时 `/models` 结果，并同步本地配置与契约测试。
- 在获得当次明确授权后，运行下方 Detection 的原样 probe：先验证规范化后的默认模型在目录中，
  再对同一模型发起一次固定、最小、零重试的 Chat Completions 请求。
- probe 只记录安全模型 ID、可用性、HTTP 状态和错误 code/type，不打印 key、请求内容、provider
  消息或响应正文；HTTP 402 不应被自动细分为余额、计费或额度问题。
- 健康检查、mock 测试和进程重启继续用于各自边界，但不得作为真实模型可生成的替代证据。

## Detection

以下命令从仓库根目录运行，读取当前 provider 配置，按仓库规则解析 key（不打印），先调用认证的
`/models` 并规范化默认模型，再在模型存在时执行一次固定的最小生成资格 probe。模型不存在、
生成被拒绝或请求失败均以非零退出；异常处理不打印异常消息或响应正文，只输出安全状态字段。

```powershell
Push-Location backend
@'
from app.langgraph_runtime.deepseek_client import normalize_deepseek_model_name
from app.langgraph_runtime.deepseek_config import load_deepseek_provider_config
from app.langgraph_runtime.deepseek_env import resolve_deepseek_api_key_with_dotenv_fallback
from openai import APIStatusError, OpenAI

configured_model = "<config-unavailable>"
model_ids = []
try:
    config = load_deepseek_provider_config()
    configured_model = normalize_deepseek_model_name(config.default_model)
    api_key = resolve_deepseek_api_key_with_dotenv_fallback(config)
    client = OpenAI(base_url=config.base_url, api_key=api_key, max_retries=0, timeout=30.0)
    model_ids = sorted({item.id for item in client.models.list().data if isinstance(item.id, str)})
    model_available = configured_model in model_ids
    print("provider_model_ids=" + ",".join(model_ids))
    print("configured_model_id=" + configured_model)
    print("configured_model_available=" + str(model_available).lower())
    if not model_available:
        raise SystemExit(1)
    client.chat.completions.create(
        model=configured_model,
        messages=[{"role": "user", "content": "Reply OK."}],
        max_tokens=1,
        temperature=0,
    )
    print("generation_http_status=success")
    print("generation_error_code=<none>")
    print("generation_error_type=<none>")
except SystemExit:
    raise
except APIStatusError as exc:
    print("generation_http_status=" + str(exc.status_code))
    print("generation_error_code=" + str(exc.code or "<unknown>"))
    print("generation_error_type=" + str(exc.type or "<unknown>"))
    raise SystemExit(2)
except Exception:
    if not model_ids:
        print("provider_model_ids=<unavailable>")
        print("configured_model_id=" + configured_model)
        print("configured_model_available=false")
    print("generation_http_status=<unavailable>")
    print("generation_error_code=<unknown>")
    print("generation_error_type=<unknown>")
    raise SystemExit(3)
'@ | .\.venv\Scripts\python.exe -
$probeExit = $LASTEXITCODE
Pop-Location
exit $probeExit
```

该 probe 会访问真实 provider、读取本地凭据并产生一次最小生成请求，**每次运行前都必须取得当前
任务的明确授权**；它不属于离线 harness，也不得在普通 CI 中自动运行。未获授权时，验收必须标为
“未验证实时模型目录与生成资格”。`node scripts/check_harness.mjs` 只检查故障记忆结构；`/models`
成功也只证明认证和模型发现，二者都不能证明 Chat Completions 生成资格。

## Evidence

- 事故观察：用户路径返回 502；最初健康检查与 mock 测试通过。
- 模型目录观察：历史配置 `deepseek-chat` 未被公开，当时认证目录只返回
  `deepseek-v4-flash` 与 `deepseek-v4-pro`；这证明配置需要刷新，不证明 live 502 的最终原因。
- 当前模型生成诊断：单次、零重试的直接 Chat Completions 返回脱敏 `APIStatusError`，HTTP 402、
  code `invalid_request_error`、type `unknown_error`；未查看或记录 provider 消息、响应正文或凭据。
- 当前修正后的 [Provider 配置](../../backend/config/providers.yaml)
- [配置加载与 key 解析](../../backend/app/langgraph_runtime/deepseek_config.py)
- [dotenv fallback](../../backend/app/langgraph_runtime/deepseek_env.py)
- [客户端与模型名规范化](../../backend/app/langgraph_runtime/deepseek_client.py)
- [DeepSeek v4 Flash 配置更新设计](../superpowers/specs/2026-08-04-deepseek-v4-flash-model-refresh-design.md)
- [DeepSeek v4 Flash 实施计划](../superpowers/plans/2026-08-04-deepseek-v4-flash-model-refresh.md)
- [Harness 检查](../../scripts/check_harness.mjs)

历史 `deepseek-chat` 来自事故观察及 durable design/plan 记录的旧配置 RED→GREEN 差异；当前
`providers.yaml` 只证明修正后状态。HTTP 402 的确切商业子原因保持未确认。
