---
name: record-failure
description: 在 docs/failures/ 下新建一条失败记忆记录。当出现用户可见、高风险或可能复发的问题时使用;触发词:failure、postmortem、复盘、故障记录、假绿、false green。
---

# 记录失败记忆

## 何时用

只记录用户可见、高风险或可能复发的问题——不是所有 bug 都要写,琐碎的、
一次性的不需要。

## 步骤

1. 文件名格式:`docs/failures/<日期 YYYY-MM-DD>-<kebab-case-短名>.md`。
2. 必须包含以下五个二级标题(`scripts/check_harness.mjs` 会逐个核对,
   降级成 `###` 不算通过):
   - `## Summary`(一两句话说清楚发生了什么)
   - `## Root Cause`(根因,不是表面现象)
   - `## Prevention`(以后怎么从根上避免,不是"下次注意点")
   - `## Detection`(怎么自动发现;如果自动化会误导,写清楚人工检查点
     和原因)
   - `## Evidence`(相关 ADR、CI、代码位置的链接)
3. `Detection` 一节尽量指向 `scripts/check_harness.mjs` 或其他真实可运行
   的检查,不要只写"以后小心点"这类无法验证的承诺。
4. 写完后运行 `node scripts/check_harness.mjs`,确认新文件通过章节完整性
   检查。
