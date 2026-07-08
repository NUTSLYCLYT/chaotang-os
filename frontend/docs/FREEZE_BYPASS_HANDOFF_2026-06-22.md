# 交接单 · 部门学习冻结越界 止血(给该地盘的窗口/agent)

> 2026-06-22 · 后端会审窗口产出 · 给**正在改 orchestrate/sign-off/department-learning 的窗口**。
> 这些文件是你的活跃 WIP,我没碰(地盘协议)。下面是 6 大神会审(workflow wy1tg27my)+ 真码核验出的 4 类越界 + 逐条修法。**修完跑 `bash scripts/courtos-freeze-guard.sh` 必须退出 0。**

## 背景一句话
铁律5 明令"部门学习冻结"(隔离骨架、不挂 live、停投入),但它被绕过——焊进了 **6 处生产决策门 + 1 道安全后门**。守护锁 `da3a456` 已把这些钉成 CI 红。

## 🔴 必修(按危害排序)

### 1. CRITICAL 安全后门 —— `src/lib/department-learning/real-source.ts:37`
```ts
function isE2eEvidenceId(evidenceId) {
  return process.env.NODE_ENV !== 'production' && /^e2e-[a-z0-9-]+$/i.test(evidenceId)
}
// :65-68  if (isE2eEvidenceId(...)) return { ok:true, archiveConfirmed:true }  ← 跳过签核+史馆双证据
```
**危害**:非 prod 环境用 `e2e-xxx` 凭空伪造"老板签核+史馆归档",提权任意部门进生产路由。测试夹具的方便门=攻击者的提权门;别假设 NODE_ENV 在所有部署面可信。
**修**:移除 `isE2eEvidenceId` 旁路;E2E 测试改用真实 mock 注入,不靠生产代码里的 NODE_ENV 后门。

### 2. CRITICAL 决策泄漏 —— `src/app/api/court/orchestrate/route.ts:83,85,104,150,163,198`
`orderDepartmentsByAdvisorSignal` 用冻结的部门学习 verdict **重排部门顺序**、`learningAdvisorSignals` 喂军机处排序/措辞。**冻结特性正在影响"哪个部门先会审、御座看到什么"——不是空转,是转进了裁决。**
**修**(二选一):
- (推荐)落 `DEPARTMENT_LEARNING_FEED_DECISIONS` 环境闸,**默认 off**;闸关时 `advisorSignals`/`scopedAdvisorSignals` 一律返 `[]`,`orderDepartmentsByAdvisorSignal` 退化为原序。
- 或直接摘掉这条"喂决策"边,回到不受学习影响的排序。
> Schneier:任何能改变裁决的东西,有无版面都必须过门;藏进"裁决属性"逃过版面预算审查,是最坏的。

### 3. 冻结越界 · 写入门 —— `src/app/api/court/orchestrate/sign-off/route.ts:21,77`
sign-off 特权写入门 fire-and-forget 调 `applyDepartmentLearningOutcomeFromBossSignoff`。虽是 `.catch` 非阻断、写独立表(不污染 tasks),但仍是冻结特性挂 live 写入门。
**修**:同 #2 的环境闸关死,或注释掉 line77 调用(零功能损失)。

### 4. 冻结越界 · 4 个 live 学习路由
`src/app/api/court/learning/{real-source,advisor-signal,records,calibration}/route.ts` —— 在冻结特性上建了整套 API 面。
**修**:这些路由 feature-flag 关死(默认 off)或随骨架一起 stash 进 `frozen-dept-learning-not-wired` 分支。冻结=不挂任何 live。

## ✅ 别误删(karpathy:冻结的是飞轮,不是验真的尺)
`real-source.ts` 的**双证据校验器**(签核链 + `hasCourtArchive` 才给 `confirmed`,否则只 `observing`,不造假 trace)是本仓最稀缺的 trace 诚实度纪律。**抽出来留着**给主决策真链接线后复用,别陪葬。

## 补一条回归断言(铁律4 强制)
钉死:「sign-off 走一遍后,主库 `tasks` 表零新增学习行;`department_learning` 表只在双证据下落 `confirmed`;`applied:false` 时零写入」。`store.nodetest.ts` 已在改,让它证这几条。并开一个**不在你上下文的 code-reviewer** 读真实 diff,溯源谁绕的冻结、还有没有别处。

## 验收
```bash
bash scripts/courtos-freeze-guard.sh   # 必须 ✅ 退出 0
pnpm exec tsc --noEmit && pnpm build    # 双门绿
```
锁转绿后通知后端窗口,我把守护锁挂进 build 门,让冻结永久机器化。

> 完整背景:`docs/COURTOS_DELIVERY_PLAN_2026-06-21.md` · 会审 wy1tg27my · 记忆 dept-learning-freeze-bypassed
