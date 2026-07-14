FROM python:3.12-slim

WORKDIR /app

# 系统依赖
# APT_MIRROR 默认中性(官方源);国内构建传 --build-arg APT_MIRROR=mirrors.tuna.tsinghua.edu.cn 提速
ARG APT_MIRROR=deb.debian.org
RUN if [ "$APT_MIRROR" != "deb.debian.org" ]; then \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g; s|security.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list.d/debian.sources 2>/dev/null || true; \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list 2>/dev/null || true; \
    fi && \
    apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Python 依赖（requirements.txt 聚合 core + optional + test）
# PIP_INDEX_URL 默认中性(官方源);国内构建可传 --build-arg PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple 提速
ARG PIP_INDEX_URL=https://pypi.org/simple
COPY requirements.txt requirements-core.txt requirements-optional.txt requirements-test.txt ./
RUN pip install --no-cache-dir -i ${PIP_INDEX_URL} -r requirements.txt

# 项目代码
COPY . .

# 数据目录（挂载点）
ENV FENGQUN_RUNTIME_ROOT=/app/var
RUN mkdir -p var/data var/events var/memory var/sessions var/swarm_sessions \
    var/traces var/direct_cache var/direct_feedback \
    var/repairs var/drafts var/reports var/cases var/ab_tests \
    prompt_versions knowledge/chroma_db

# 初始化 runtime_prompts（如果不存在）— 必须包含所有 prompts_* 模块
RUN python3 -c "\
import src.prompts, src.prompts_haolong, src.prompts_product, \
       src.prompts_quotation, src.prompts_ai_ops, src.prompts_aftercare, src.prompts_qa_v2; \
from src.prompt_composer import init_runtime_prompts_from_code; \
init_runtime_prompts_from_code()"

# 初始化默认管理员（admin / admin123）
RUN python3 -c "from src.tenant import ensure_admin; ensure_admin()"

EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# FastAPI 入口 — UvicornWorker 支持 async / SSE / WebSocket
CMD ["gunicorn", "web.main:app", \
     "--bind", "0.0.0.0:8080", \
     "--workers", "2", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--timeout", "300", \
     "--graceful-timeout", "30", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
