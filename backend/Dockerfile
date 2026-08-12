ARG PYTHON_IMAGE
FROM ${PYTHON_IMAGE} AS builder

ARG PIP_INDEX_URL=https://pypi.org/simple

WORKDIR /build
COPY pyproject.toml ./
COPY app ./app
RUN python -m pip wheel --no-cache-dir --index-url "$PIP_INDEX_URL" --wheel-dir /wheels .

FROM ${PYTHON_IMAGE} AS runner
ARG PIP_INDEX_URL=https://pypi.org/simple
WORKDIR /app
COPY --from=builder /wheels /wheels
RUN python -m pip install --no-cache-dir --index-url "$PIP_INDEX_URL" /wheels/*.whl \
    && rm -rf /wheels \
    && groupadd --gid 10002 chaotang \
    && useradd --uid 10002 --gid 10002 --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin chaotang \
    && mkdir -p /app/data /app/artifacts \
    && chown -R 10002:10002 /app/data /app/artifacts
COPY --from=builder /build/app ./app
COPY config ./config
USER 10002:10002
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]
