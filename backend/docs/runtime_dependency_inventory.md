# 运行依赖清单

本文件记录当前后端主线依赖、但不能复制进 git 仓库的外部运行资产。

## 受保护外部资产

以下路径是 Linux 部署环境的默认位置，实际路径以环境变量和部署清单为准。

| 资产 | 默认路径 | 用途 | 是否入库 |
| --- | --- | --- | --- |
| 本地 AI 运行目录 | `/home/ubuntu/local-ai` | Ollama helper scripts、本地 genius controller、模型下载元数据 | 否 |
| Ollama 模型目录 | `/home/ubuntu/local-ai/models/ollama` | 本地推理使用的大模型 blob | 否 |
| GGUF 下载目录 | `/home/ubuntu/local-ai/models/downloads` | 原始模型文件 | 否 |
| 史馆 vault | `/home/ubuntu/CourtOS-Brain` | Obsidian vault 和长期记忆 | 否 |
| Super Brain 服务 | `/home/ubuntu/super_brain_backend` | 旧史馆 API 和 Obsidian watcher；替换前保持运行 | 否 |

## 当前后端集成文件

| 文件 | 作用 |
| --- | --- |
| `src/local_ai_bridge.py` | 本地 AI bridge、状态检查、安全命令 allowlist、Ollama fallback、CourtOS-Brain 只读审计 |
| `web/routers/local_ai.py` | 后端 Local AI / 史馆 bridge API |
| `docs/local_ai_fusion.md` | 后端集成契约与操作说明 |
| `tests/test_local_ai_bridge.py` | bridge 与只读审计回归测试 |

## 删除规则

除非后端主线已有替代方案，并且对应外部服务已被明确停止或禁用，否则不要删除受保护外部资产。

可以不经复核删除：

- `__pycache__`
- 临时截图或 `.shot-tmp.*`
- 已确认下载完成后的过期 `.aria2` 文件

不要不经复核删除：

- `.env` 文件
- SQLite 数据库
- 模型文件
- Obsidian vault 内容
- 活跃 systemd 服务的源码目录
