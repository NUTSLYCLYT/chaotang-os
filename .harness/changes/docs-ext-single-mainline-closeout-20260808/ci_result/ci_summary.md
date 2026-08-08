# CI 证据

| 检查 | 结果 | 说明 |
| --- | --- | --- |
| R0-W08 execution authority v2 | PASS | `GO / APPROVED_WORK_PACKAGE` |
| S3 RED | PASS（预期失败） | 13 项中 11 failed；高分假声明和标识符误盖章均被捕获 |
| S3 focused GREEN | PASS | 13 passed |
| S3 + confidence focused | PASS | 29 passed |
| court/W08 adjacent regression | PASS | 31 passed, 2 skipped |
| syntax + Ruff | PASS | py_compile 通过；Ruff 无问题 |
| backend Harness Doctor | PASS | 0 errors, 0 warnings |
| root Harness Doctor | PASS | 0 errors, 0 warnings |
| `git diff --check` | PASS | 无空白错误 |
| 既有 knowledge tests | PARTIAL | 合并相邻集共 21 passed，1 个真 embedding 用例因环境退化到 md5 假向量而失败；旧逻辑同样低于阈值 |

集成与远端 SHA 在候选提交后回填。
