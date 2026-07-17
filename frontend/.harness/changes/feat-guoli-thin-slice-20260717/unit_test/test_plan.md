# 单测计划

## 覆盖范围

- LIVE 值与后端事实元数据保持。
- NO_DATA 不格式化百分比。
- 契约元数据缺失时拒绝，不本地合成。
- feature flag 默认开、显式 false 关闭。
- 后端空台账与真实生产写入路径计算。
- 混合 UTC offset 时间戳按绝对时间计算窗口边界。
- 上书房 finance-intel-loop 生产调用必须使用统一 transport 和 canonical endpoint。

## 命令

- `pnpm exec tsx --test src/features/guoli/lib/guoli-overview.nodetest.ts`
- `python3 -m pytest -q tests/test_guoli_overview.py`
- `pnpm exec tsx --test src/features/shangshufang/finance-intel-loop-path.nodetest.ts`

## 未覆盖风险

- React 分支不使用组件单测；由真实浏览器 snapshot/API-body 对照覆盖。
