# 锦衣卫 Scrapling POC Harness

本 harness 是锦衣卫网页采集/观测 POC 的主文档入口。它保持保守：只验证采集路径、失败原因和下一步，不把采集结果直接当成可信业务结论。

## 关系

- `jinyiwei-scrapling-poc/`：人读文档与主入口。
- `jinyiwei_scrapling_poc/`：Python 实现包。

两者关系记录在 `backend/harness/manifest.json`。

## 入口

```bash
cd backend
python harness/jinyiwei_scrapling_poc/scripts/run_scrapling_poc.py
```

如果 Scrapling 未安装，runner 应给出安装指引并安全退出。
