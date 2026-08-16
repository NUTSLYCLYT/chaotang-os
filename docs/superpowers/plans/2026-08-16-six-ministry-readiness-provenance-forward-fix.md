# Six Ministry Readiness Provenance Forward Fix Plan

## 1. Contract

- Task：`SIX-MINISTRY-READINESS-PROVENANCE-FORWARD-FIX-20260816`
- Base/tree：`61971de5c2375be20462372582d8465c6e789a26` /
  `0f83ce146163588d1a820fe2a74b2e3d460bf813`。
- 采用 forward-only 普通提交；禁止 force-push、rebase 或覆盖已落地的旧候选。
- approval 只含 task、packet、plan；candidate 只修改两个 validator。

## 2. RED to GREEN

1. RED：把真实 `approved-with-notes` 改成 `approved` 且保留合法历史 fingerprint，现有两道门均错误放行。
2. GREEN：Python 与 Harness 都精确固定 `approved-with-notes` 和 `a6c2…`。
3. Negative：拒绝 `changes-requested/null`、`approved` status-only、批准态 null fingerprint。
4. 保持：69 历史文件、67 当前内容文件、两个 validator 排除集和 `6f4158…` 不变。

## 3. Commit Protocol

1. 在冻结 base 上形成精确单亲 approval commit，机械核验 3 个 approval paths。
2. 计算 packet RFC 8785 canonical digest，交 Owner 明确确认后才推送 approval。
3. 在 approval 上形成精确单亲 candidate，机械核验 2 个 candidate paths。
4. 完整验证与 code/security review 后，把 candidate SHA/tree 交 Owner 二次确认。
5. 只允许普通 fast-forward 推送；远端移动即 STOP 并重新签发。

## 4. Proof Matrix

运行 packet 中冻结的九条离线命令，并额外执行：

```bash
git diff --check <approval> <candidate>
git show -s --format='%P' <candidate>
git diff --name-only <approval> <candidate>
```

## 5. Product-line Recovery

治理 candidate 安全落地后，以新 `ext-dev` HEAD 重新签发双编排 6 路径 approval；旧双编排
approval/candidate 不得直接合并或绕过新基线。公共合同落地后，另开最小运行时纵切任务，真实 API 与
浏览器验收通过后才向用户提供测试链接。

## 6. Stop Conditions

- Owner 未确认精确 digest 或 SHA/tree。
- 远端离开冻结 base/approval。
- 路径扩大、任何验证失败或 review finding 未关闭。
- 需要 force-push、历史改写、跳过测试或用 mock 冒充真实功能。
