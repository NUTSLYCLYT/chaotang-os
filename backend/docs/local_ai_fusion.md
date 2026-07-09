# 本地 AI / 史馆融合

本文件只描述后端与外部本地 AI、史馆知识库的集成边界。外部运行资源不进入 git 仓库，后端只通过 `src/local_ai_bridge.py` 访问。

## 外部资源

以下路径是 Linux 部署环境的默认值，实际以环境变量为准：

- 本地模型运行目录：`LOCAL_AI_ROOT`，默认 `/home/ubuntu/local-ai`
- 史馆知识库：`COURTOS_BRAIN_PATH`，默认 `/home/ubuntu/CourtOS-Brain`
- 主模型：`qwen3.6-35b-a3b-q4`
- OpenAI-compatible endpoint：`http://127.0.0.1:11434/v1`

不要把模型权重、Ollama blob 或 Obsidian vault 复制到本仓库。

## API

- `GET /api/local-ai/status`
- `GET /api/local-ai/audit-courtos-brain`
- `POST /api/local-ai/index-courtos-brain`
- `POST /api/local-ai/ask`
- `GET /api/preflight` 会包含 `localAI` 区段，并在 bridge 或 vault 不可用时给出 warning。

`index-courtos-brain` 会把 `COURTOS_BRAIN_PATH` 传给 `${LOCAL_AI_ROOT}/play.sh index`。它只写入 local-ai 的 SQLite 知识库，不写入史馆 vault。

`audit-courtos-brain` 是只读检查：扫描 `_wiki/sources`、`_wiki/concepts` 和 `_wiki/entities`，识别过期 source path、重复 source、孤立概念/实体和 stub 数量。

## 环境变量

```bash
LOCAL_AI_ROOT=/home/ubuntu/local-ai
COURTOS_BRAIN_PATH=/home/ubuntu/CourtOS-Brain
OPENAI_BASE_URL=http://127.0.0.1:11434/v1
OPENAI_API_KEY=ollama
LOCAL_AGENT_MODEL=qwen3.6-35b-a3b-q4
LOCAL_AI_TIMEOUT_SEC=180
```

## 后端验证

在当前仓库后端目录运行：

```bash
cd backend
python -m pytest -q tests/test_local_ai_bridge.py
```

外部本地运行资源可单独检查：

```bash
cd "$LOCAL_AI_ROOT"
./play.sh status
./play.sh index "$COURTOS_BRAIN_PATH"
./play.sh genius "基于史馆和本地 AI 配置，给我下一步建议"
```
