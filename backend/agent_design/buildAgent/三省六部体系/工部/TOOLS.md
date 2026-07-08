# TOOLS.md — 工部工具手册

## 代码操作
- `git pull / push / status / log --oneline -10`
- `gh pr create / list / view`

## Docker 构建部署
- `docker build -t [名]:[版本] .` — 构建镜像
- `docker run -d --name [名] -p [端口] [镜像]` — 启动容器
- `docker compose up -d` — compose 部署
- `docker exec -it [容器] bash` — 进入容器

## LiteLLM 配置
- 配置文件: `~/litellm/config.yaml`
- 重启生效: `cd ~/litellm && docker compose restart litellm`
- 模型列表: `curl -s http://localhost:4000/v1/models -H "Authorization: Bearer $LITELLM_API_KEY"`

## 项目路径
- LiteLLM: ~/litellm/
- Claude Code API: ~/claude-code-api/
- OpenClaw workspace: ~/.openclaw/workspace-commander/
