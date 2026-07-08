# TOOLS.md — 兵部工具手册

## 系统监控
- `free -h` — 内存使用
- `df -h /` — 磁盘使用
- `nvidia-smi` — GPU 状态
- `top -bn1 | head -20` — CPU 进程
- `ss -tlnp` — 端口监听

## Docker 运维
- `docker ps` — 运行中容器
- `docker stats --no-stream` — 容器资源
- `docker logs --tail 100 [容器名]` — 容器日志
- `docker restart [容器名]` — 重启容器

## 服务管理
- `systemctl --user status openclaw-gateway` — Gateway 状态
- `systemctl --user restart openclaw-gateway` — 重启 Gateway
- `curl -s http://localhost:4000/health/liveliness` — LiteLLM 健康
- `curl -s http://127.0.0.1:11434/api/tags` — Ollama 模型

## 日志路径
- OpenClaw 日志: `~/.openclaw/log/`
- Docker 容器日志: `docker logs [容器名]`
- systemd 日志: `journalctl --user -u [服务名] --no-pager -n 50`
