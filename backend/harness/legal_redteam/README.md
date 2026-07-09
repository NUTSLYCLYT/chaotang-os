# 法务红队实现包

`legal_redteam` 是 `legal-redteam` 的 Python 实现包，负责执行法务红队用例并生成可测试结果。

## 验证

```bash
cd backend
python -m pytest -q tests/test_legal_redteam_harness.py
```

主用例和 promptfoo 配置仍放在 `harness/legal-redteam/`，避免 Python import 命名和人工入口混在一起。
