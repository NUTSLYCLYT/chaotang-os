# Packet P5 审查报告：fix-alembic-single-authority-20260717

| 绑定项 | 值 |
| --- | --- |
| ext merge | `346dc81`（37 文件 +1724/-800） |
| 审查基线 | `p5-review-baseline.md` v2（被本包 spec 引为事实源） |
| 审查方式 | 四 checkpoint 滚动预审 + 合入后基线逐项核销 + 独立重跑 |
| 时间 | 2026-07-17 02:4x–02:5x（命令戳为准） |

## 基线核销（v2 全项）

| 项 | 处置 | 判定 |
| --- | --- | --- |
| A1 create_all（main.py:95） | 移除；启动走 schema_authority strict fail-closed（modes: strict/dev-bootstrap/test，dev 限 SQLite、test 需 GUARD） | ✅ |
| B1–B6 六个 ensure_* | 五个删除（flow_store -426）；B1 留 **no-op shim**（DDL 清零，留名服务冻结大殿调用方，docstring 明示权威归属）——诚实处置 | ✅ |
| C1 tenant.py 第四权威 | **正面收编**：014 迁移纳管 tenant 三表（超基线预期，未走 deferred） | ✅ |
| C2–C4 专项库（memory/RAG/kpi） | 非目标节显式豁免登记 | ✅ |
| 运行时 DDL 守门 | `test_primary_schema_has_no_runtime_ddl`（AST 扫描常驻化） | ✅ |

## 挂号问题销案

- **ImportError 裸漏**：架构级解决——schema_authority 重构为**零 alembic
  运行时依赖**（文件系统+AST 解析 versions/ 推导期望 head；SQLAlchemy
  inspector 查 alembic_version 表）。系统 Python 下 9 passed+1 skip，
  比我提的两个方案都好。
- **历史迁移修改论证**：adoption 套件三起点证据（fresh/downgrade/无版本
  create_all 收养）+ 004b safe stamp 路径 + 只读备份副本演练
  （28 表/1357 行零变化）——修改历史文件的收养语义无害性成立。

## 重大真实事件（审查确认）

**真实控制面库已实际停服迁移至 head**：011–014 前置核验、迁移后完整性 ok、
关键行数 17/12/14/32 保持——census DATA-02"生产库可重复迁移无法证明"
的历史断言就此翻页。

## 独立重跑

schema/adoption/no-runtime-ddl 套件 9+1skip；主链回归 46 passed
（final_memorial/outbox/loop_api/tripwire）；spec 记录全量 pytest
修正后 2703 passed/7 基线失败（零新增）。

## 裁决

燃尽更新：门 1 **6/10**（P0–P5）。后续：push 前按 D6 闸生成 approval
envelope；P6 开工（守门语义迁移+死码退役——LOC 归因表等它）。

PACKET_REVIEW_GO
