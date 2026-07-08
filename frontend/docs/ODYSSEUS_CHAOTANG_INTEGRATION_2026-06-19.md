# Odysseus x Chaotang Integration

Date: 2026-06-19

## Current State

- Odysseus lives outside the Chaotang frontend repo at `/home/ubuntu/dev/external/odysseus`.
- Chaotang frontend remains `/home/ubuntu/workspace/frontend/chaotang-web-lyt`.
- Odysseus Docker stack is running locally:
  - UI: `127.0.0.1:7000`
  - SearXNG: `127.0.0.1:8080`
  - ChromaDB: `127.0.0.1:8100`
  - ntfy: `127.0.0.1:8091`
- The UI returns `302 /login`, so auth is enabled.
- Odysseus should not be exposed directly to the public internet.

## Recommended Deployment Shape

Do not copy Odysseus into the Next.js app.

Use it as a sidecar AI workspace:

```text
Chaotang Next.js
  -> controlled entry page / health indicator / workflow handoff
  -> local reverse proxy or internal service link
Odysseus Docker stack
  -> chat, research, docs, notes, MCP, model comparison
LiteLLM gateway
  -> shared model routing
```

This keeps Chaotang as the product shell and keeps Odysseus as an operator cockpit.

## What Can Be Embedded In Chaotang

Safe:

- Add a Chaotang page or drawer linking to Odysseus as "翰林实验室 / 大神工作台".
- Add a server-side health check for Odysseus availability.
- Add a task handoff button that copies a prompt or opens an internal Odysseus session.
- Add docs and presets for advisor workflows.

Risky:

- Reverse proxying all Odysseus UI under `/chaotang/odysseus`.
- Sharing Chaotang cookies with Odysseus.
- Giving Odysseus shell/file/email tools public access.

Forbidden for now:

- Treating Odysseus as a replacement for CourtOS production Loop/Harness.
- Letting Odysseus silently execute high-risk business actions.
- Exposing raw Odysseus or model ports publicly.

## P0 Fixes Before Public/Internal Rollout

1. Make the LiteLLM bridge durable.
   - Current issue: container can resolve `host.docker.internal` to `172.21.0.1`, but the bridge is not durable as a background process.
   - Correct fix: install a systemd user service or compose sidecar for `host-gw-forward.py`.
   - Health target: container request to `http://host.docker.internal:4444/v1/models` should return HTTP `401` or `200`, not `Connection refused`.

2. Version the local bridge scripts.
   - Current untracked files:
     - `/home/ubuntu/dev/external/odysseus/host-gw-forward.py`
     - `/home/ubuntu/dev/external/odysseus/host-gw-forward-ollama.py`
   - These should become tracked operational files or move to a local ops directory.

3. Keep auth closed.
   - Odysseus must keep `AUTH_ENABLED=true`.
   - Any reverse proxy must require Chaotang-side auth plus Odysseus auth unless there is an explicit SSO design.

4. Add a Chaotang-side entry point only after P0 bridge and auth checks pass.
   - Suggested route: `/hanlin/odysseus` or `/jiqun/odysseus`.
   - It should show status, usage recipes, and a guarded "Open Odysseus" action.

## Advisor Usage

Use "大神" as task-specific advisor presets, not as generic chat decoration.

Daily defaults:

- AI system build: `karpathy + andrew-ng`
- Production reliability: `charity-majors + deming`
- Security and autonomy: `bruce-schneier + stuart-russell`
- Product restraint: `zhangxiaolong + jobs`
- Strategic one-way-door decisions: `munger + taleb`

Prompt pattern:

```text
任务：<要解决的问题>
上下文：<业务背景 / 约束 / 当前证据>
请上 <advisor pair> 会审。
输出：
1. 最危险的盲点
2. 反直觉但可执行的建议
3. 需要补的证据
4. 下一步最小动作
```

Examples:

```text
上产品克制那对：这个 Odysseus 入口是否应该出现在朝堂首页？
```

```text
上安全对抗那对：如果把 Odysseus 反代到 app.mingshuoxny.com/chaotang/odysseus，最可能出事的权限边界是什么？
```

```text
上 AI 系统工程那对：Odysseus 的 Research / Docs / MCP 能力，哪些应该沉淀成 CourtOS Harness，哪些只做外部工具？
```

## Integration Decision

Yes, Odysseus can be deployed alongside Chaotang, but it should be deployed as a sidecar cockpit first.

It should not be merged into the Chaotang Next.js runtime until:

- auth and audit are explicit,
- LiteLLM bridge is durable,
- high-risk tools are gated,
- and the integration has a clear Loop role.

Best first role:

```text
翰林实验室 / 大神工作台
```

Purpose:

- research references,
- compare model answers,
- draft docs,
- run advisor presets,
- prepare evidence for CourtOS decisions.

It should feed Chaotang decisions, not bypass them.
