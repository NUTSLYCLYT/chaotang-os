FROM --platform=linux/amd64 docker.io/library/python@sha256:356b0d18f9385f4bdcc673af60e1e64c9d1504952e4ec36ee32044c722a6bc4e AS builder

ENV VIRTUAL_ENV=/opt/runtime \
    PATH=/opt/runtime/bin:$PATH
WORKDIR /build

RUN python -m venv "$VIRTUAL_ENV"
COPY pyproject.toml ./pyproject.toml
COPY requirements-runtime.lock ./requirements-runtime.lock
COPY app/operations/runtime_lock.py ./app/operations/runtime_lock.py
COPY --from=backend-wheelhouse / /wheelhouse
RUN python -I app/operations/runtime_lock.py prepare-install \
        --lock requirements-runtime.lock \
        --wheelhouse /wheelhouse \
        --pyproject pyproject.toml \
        --output-dir /tmp/p15-requirements \
    && pip install --isolated --no-cache-dir --no-index --require-hashes --no-deps \
        --only-binary=:all: --find-links /wheelhouse -r /tmp/p15-requirements/build.txt

COPY app ./app
RUN pip wheel --no-index --no-build-isolation --no-deps --wheel-dir /wheels . \
    && pip install --isolated --no-cache-dir --no-index --require-hashes --no-deps \
        --only-binary=:all: --find-links /wheelhouse -r /tmp/p15-requirements/runtime.txt \
    && pip install --isolated --no-cache-dir --no-index --no-deps --no-compile \
        --target /wheel-app /wheels/chaotang_os_backend-*.whl \
    && pip uninstall -y pip setuptools wheel hatchling pathspec pluggy pytest iniconfig pygments tomlkit trove-classifiers \
    && rm -rf /wheels \
        /opt/runtime/bin/pip* \
        /opt/runtime/lib/python*/site-packages/pip* \
        /opt/runtime/lib/python*/site-packages/setuptools* \
        /opt/runtime/lib/python*/site-packages/wheel* \
        /opt/runtime/lib/python*/site-packages/hatchling* \
        /opt/runtime/lib/python*/site-packages/pathspec* \
        /opt/runtime/lib/python*/site-packages/pluggy* \
        /opt/runtime/lib/python*/site-packages/pytest* \
        /opt/runtime/lib/python*/site-packages/_pytest* \
        /opt/runtime/lib/python*/site-packages/iniconfig* \
        /opt/runtime/lib/python*/site-packages/pygments* \
        /opt/runtime/lib/python*/site-packages/tomlkit* \
        /opt/runtime/lib/python*/site-packages/trove_classifiers*

FROM --platform=linux/amd64 docker.io/library/python@sha256:356b0d18f9385f4bdcc673af60e1e64c9d1504952e4ec36ee32044c722a6bc4e AS runner

ARG SOURCE_REVISION
ARG SOURCE_TREE
ARG SOURCE_CREATED
LABEL org.opencontainers.image.revision=$SOURCE_REVISION \
      io.chaotang.source.tree=$SOURCE_TREE \
      org.opencontainers.image.created=$SOURCE_CREATED

ENV VIRTUAL_ENV=/opt/runtime \
    PATH=/opt/runtime/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app

COPY --from=builder /opt/runtime /opt/runtime
COPY --from=builder /wheel-app /app
COPY config ./config
RUN groupadd --gid 10002 chaotang \
    && useradd --uid 10002 --gid 10002 --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin chaotang \
    && mkdir -p /app/data \
    && chown -R 10002:10002 /app/data \
    && rm -rf /usr/local/bin/pip* \
        /usr/local/lib/python*/ensurepip \
        /usr/local/lib/python*/site-packages/pip* \
        /usr/local/lib/python*/site-packages/setuptools* \
        /usr/local/lib/python*/site-packages/wheel* \
    && python -c "import importlib.metadata,pathlib,app; root=pathlib.Path('/app').resolve(); path=pathlib.Path(app.__file__).resolve(); dist=importlib.metadata.distribution('chaotang-os-backend'); assert path.is_relative_to(root) and pathlib.Path(dist.locate_file('')).resolve()==root and dist.read_text('RECORD')"

USER 10002:10002
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).read()"]
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]
