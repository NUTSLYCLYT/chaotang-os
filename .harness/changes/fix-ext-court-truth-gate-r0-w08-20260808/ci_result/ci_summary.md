# CI 证据

- RED：`test_court_vet_adversarial.py` -> `11 failed, 2 passed`。
- GREEN：`test_court_vet_adversarial.py` -> `13 passed`。
- S3 + confidence focused：`29 passed`。
- court/W08 相邻回归：`31 passed, 2 skipped`。
- py_compile、Ruff、backend/root Harness Doctor 与 `git diff --check` 全部通过。
- 真 embedding 回归在本机无 embedding provider 时退化到 md5 假向量，既有真声明相关度
  为 0.2429，低于既有 0.35 阈值；记录为环境限制，不下调生产门槛制造假绿。
