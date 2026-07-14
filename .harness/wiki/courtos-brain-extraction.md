# CourtOS-Brain 独立化门禁

`courtos-brain/` 当前是历史 subtree，只作为只读知识归档暂留仓内。目标是把它迁出 `chaotang-os`，但删除前必须同时满足以下门禁，不能用“本地还有一份目录”代替可恢复证据。

## 当前结论

- 仓内 subtree 与 `/home/ubuntu/CourtOS-Brain` 不是已证明等价的副本。
- 外部目录当前没有已验证的独立远端，并存在本地改动。
- 因此本轮只解除运行代码的默认依赖；不删除仓内 subtree。

## 删除门禁

1. 从固定的 `chaotang-os` 提交执行 `git subtree split --prefix=courtos-brain -b split/courtos-brain`。
2. 将 split 分支推送到独立、受保护且可克隆的远端。
3. 从空目录重新克隆独立仓库，记录远端 URL、提交 SHA 与完整文件树哈希。
4. 对账仓内 subtree、split 提交和独立克隆；差异必须逐项裁决，不能覆盖 `/home/ubuntu/CourtOS-Brain` 的未提交内容。
5. 搜索并解除所有生产代码、脚本、文档和 doctor 对仓内路径的依赖。
6. 在独立分支删除 subtree，运行根 doctor、后端知识清单测试和恢复演练。
7. 只有上述证据进入 `.harness/changes/` 后，才能合并删除提交。

## 当前配置契约

知识资源清单不再默认扫描仓内 `courtos-brain/`。需要对独立归档做只读盘点时，显式传入 `--archive /absolute/path`，或设置 `COURTOS_BRAIN_ARCHIVE_PATH`。未配置归档时，该来源不会进入清单，也不会偷偷回退到 monorepo subtree。

## 验证

```bash
cd backend
python3 -m pytest -q tests/test_knowledge_resource_inventory.py
```
