# ext Root Observation Kernel G1 Corrective Plan

> Task：`EXT-ROOT-OBSERVATION-KERNEL-G1-CORRECTIVE-20260816`
>
> Base/tree：`57c3906f483129ba60ef073ca87a0a96ab59f87a` /
> `c4f3ec1b220832ae8fe319545512f9e64dff40db`

## 1. Contract

- Scope：task 中精确四路径；path digest
  `e3026f5ffabe3bde15d9aecc29dadf477e3de86c0d5ccaa80f91f9d27aa7bd5f`。
- Non-goals digest：`48424d7a0e39cffba47a4e51e1a0c2aca81e769d221ef42f50ef8730d96deb98`。
- Authority：Owner 已批准四路径治理纠正；产品继续 STOP；Git 外部动作未授权。
- Network：仅已批准的一次 read-only `ls-remote`；实现、测试和最终 10 轮全部 offline。
- Review：solo-owner，同代理双轴 review；不得描述为 independent review。

## 2. Baseline

1. 核对 `origin` URL 与 `ls-remote ext-dev` 精确等于 base。
2. 新建以 base 为 HEAD 的隔离 worktree；不复用旧 V2，不触碰共享脏树或 M0。
3. 记录 doctor `OBSERVE`、`--ready` exit 2、ext authority STOP/product false。
4. 只在四路径内写入；schema/manifest 与其它受保护路径只读。

## 3. RED

在 `scripts/harness-doctor.test.mjs` 增加三个行为证明：

1. checked-in schema 仍通过，但添加顶层未知字段必须报 `SCHEMA_CONTRACT_INVALID`；
2. 将 `properties.root.type` 改为 `string` 必须报 `SCHEMA_CONTRACT_INVALID`；
3. repository-relative 中间目录 symlink 不能用于读取 JSON，也不能用于执行返回伪 STOP 的 authority script。

运行 `node --test scripts/harness-doctor.test.mjs`，预期仅新增断言因现有缺陷失败；环境、语法或 cwd 失败不算 RED。

## 4. GREEN

### Schema identity

- 复用 ext authority 已有 RFC 8785 canonical digest；固定 checked-in schema 的 exact canonical SHA-256。
- `validateProjectHarnessSchema` 保留现有可读结构错误，同时增加 exact digest 比较；任意未知字段、类型、required、const
  或其它 schema 语义漂移都产生 `SCHEMA_CONTRACT_INVALID`。

### Repository-relative safe read

- `pathKind` 从 repository root 开始逐段 `lstat`；中间段必须是真实目录，最终段按请求必须是真实 file/directory。
- 任一相对段为 symlink、missing 或 other 都不能被当作 regular file/directory。
- `readRepositoryFile` 继续在读取前复用该检查；`observeExtAuthority` 在 `spawnSync` 前对 authority path 做相同检查。
- 不扩大为宿主 trust root、openat daemon 或产品 authorization；G1 仍是非授权观察核。

## 5. Focused Verification

```bash
node --test scripts/harness-doctor.test.mjs
node scripts/harness-doctor.mjs --check
node scripts/harness-doctor.mjs --status
node scripts/harness-doctor.mjs --ready  # expected exit 2
```

安全定向检查：schema extra/type mutation 均被拒绝；final/intermediate symlink 均被拒绝；`__proto__` 仍作为 own key
进入 closed manifest rejection，不发生 prototype pollution。

## 6. Regression Matrix

```bash
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
node --test scripts/execution_authority_ext.test.mjs
node scripts/execution_authority_ext.mjs --status
git diff --check
```

每轮额外断言：HEAD/base 不变；scope 精确四路径；mode 仅 `100644`；无 rename/symlink/gitlink/secret/conflict；
protected paths 相对 base 哈希不变；doctor ready exit 2；authority STOP/product false；候选 fingerprint 不变。

## 7. Documentation Freeze

专项和单轮矩阵通过后，在 task 中写明实际 RED/GREEN、命令计数、同代理自审、风险与外部动作边界。
随后冻结四路径并计算 `sha256-path-null-mode-null-content-null-v1` fingerprint。

最终 10 轮针对该 fingerprint 执行。为避免回写结果使候选自失效，task 的持久语义固定为：实现已完成，最终验收由
Owner 交付报告绑定 exact fingerprint；task 本身不声称其后产生的轮次已写入文件。

## 8. Review and Handoff

- Standards：task/base/scope/non-goals、ADR 0028、STOP、single-writer、10-round 与 Git 边界。
- Security：schema identity、prototype pollution、path traversal/symlink、authority subprocess、secret/network surface。
- 无额外 reviewer 额度，报告必须写 `NO INDEPENDENT REVIEW`。
- Critical/Important 未关闭则 FAIL；任何修复会重置 fingerprint 和 10 轮。
- 10/10 后只报告 diff/fingerprint/命令/风险，等待 Owner 单独批准 commit/push/fast-forward。

## 9. Rollback and Stop

- remote/head 漂移、第五路径、产品/authority/ADR/CI/前后端变化、RED 原因错误或验证失败立即 STOP。
- landing 前不触远端；landing 后如获单独授权，只能建立受审 revert，禁止 reset、force、merge commit、rebase 或 squash。

## 10. Current Verdict

```text
Corrective task approval = ACCEPTED / FOUR PATHS
Implementation            = IMPLEMENTED / FINAL ACCEPTANCE EXTERNAL
Product authority         = STOP / false
Git external actions      = NOT AUTHORIZED
Independent review        = ABSENT
```
