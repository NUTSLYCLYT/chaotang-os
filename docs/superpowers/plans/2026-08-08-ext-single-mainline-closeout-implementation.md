# EXT 单主线收官实施计划

1. 核对 `feature-chaotang-ext@d36bb797`、Gitee 前驱和 R0-W08 GO。
2. 建立拓扑、能力处置和冻结边界账本。
3. 新建 S3 对抗测试并记录 RED。
4. 最小修改 `knowledge_vet.py` 与 `confidence_tag.py`，跑 GREEN 与相邻回归。
5. 运行根/后端 Harness Doctor、authority 和 Git 完整性检查。
6. 只暂存本轮明确路径，提交隔离候选。
7. 集成门通过后 fast-forward `feature-chaotang-ext`。
8. 推送 `origin/feature-chaotang-ext`，核对远端 SHA。
9. 释放本轮 leases；S5/运行切换留待 exact amendment。
