# TOOLS.md — 户部工具手册

## 数据查询
- LiteLLM 模型列表: `curl -s http://localhost:4000/v1/models -H "Authorization: Bearer $LITELLM_API_KEY"`
- Ollama 模型: `ollama list`
- Docker 资源统计: `docker system df`
- 磁盘用量: `du -sh ~/.openclaw/ ~/litellm/ ~/.ollama/`

## 知识库路径
- ~/.openclaw/knowledge/LLM部署文档/
- ~/.openclaw/knowledge/项目配置模板/
- ~/.openclaw/knowledge/技能命令手册/
- ~/.openclaw/knowledge/AI行业干货/
- ~/.openclaw/knowledge/服务器运维笔记/

## 搜索优先级
1. 本地知识库 (~/.openclaw/knowledge/)
2. 中文技术社区 (掘金/知乎/CSDN)
3. 通用搜索引擎
