# Test plan

- Git object DB provenance 与 tracked dirty。
- socket inode -> PID -> process identity -> concrete build dir。
- 忽略 runtime record 中伪造的 commit/build ID/digest。
- 运行期 chunk 修改、非监听 PID、commit/digest/build ID 对齐失败。
- ledger 尾删、整链重写、旧 DB 回滚与伪签名。
