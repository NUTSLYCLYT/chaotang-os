# 需求说明

## 背景

后端 DOWN 时，smoke 把操作者引向旧绝对仓库并绕过 canonical launcher。

## 范围

- DOWN 输出改为 `cd ../backend && bash scripts/serve-dev.sh`。
- 新增聚焦 test，更新根 inventory。

## 非目标

- 不改 smoke 契约、认证、超时、SKIP/exit 语义，不处理其他旧入口。

## 验收标准

- 新测试 RED→GREEN；port 9 实际 CLI 显示 canonical 命令且 exit 0。

## 风险

release gate import 同一函数；必须保持返回结构和 exit 语义不变。

## 验证计划

见 `ci_result/ci_summary.md`。
