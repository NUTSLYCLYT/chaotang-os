# 资源归并 Harness

本 harness 帮助后端主线保持干净：识别哪些路径应该沉淀、忽略、拆分或进入后续评审。

## 入口

```bash
cd backend
python harness/resource_consolidation/scripts/resource_consolidation.py
```

## 输出

典型输出可以写入：

```text
harness/resource_consolidation/artifacts/resource_manifest.json
```

## 分类原则

- 能提升后端主线质量、证据链或可复验能力的资源，进入保留或沉淀。
- 运行产物、环境漂移、本机缓存默认不提交。
- 归属其他工程线的体验实现不纳入后端 harness 资产。
- 修复后的蜂群质量基线应单独生成、单独提交。

## 测试

```bash
cd backend
python -m pytest -q tests/test_resource_consolidation.py
```
