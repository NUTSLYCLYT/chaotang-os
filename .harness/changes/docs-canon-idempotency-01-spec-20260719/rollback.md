# 回滚：docs-canon-idempotency-01-spec-20260719

## 本轮可逆边界

本 change 只新增根 change 内 Markdown。回滚时删除本 change 目录即可；不得借回滚恢复
已退役的 CANON index、parent blueprint 或 Packet catalog。没有 runtime、schema、migration
或数据库需要回滚。

## 不允许误写的未来回滚

未来一旦 ledger 接受 production claim，禁止通过 downgrade 丢失 replay history、删除 digest/tombstone 或恢复各 ingress 的 raw-key authority。安全回滚只能：

1. 停止新 adapter/ingress 写入并 fail closed；
2. 保留 ledger 与 read/replay compatibility；
3. 回到上一版单一 Backend Request Idempotency implementation；
4. forward-fix schema/key rotation/canonicalizer；
5. 证明不会双写 canonical 与 legacy replay stores。

## 演练

本轮只做文档 diff 反向可读性复核，不执行破坏性删除。未来 schema Packet 必须在隔离临时 DB 演练 upgrade/downgrade/upgrade；若 downgrade 会丢 accepted claim，则 downgrade 必须显式 fail closed，而非伪装可逆。
