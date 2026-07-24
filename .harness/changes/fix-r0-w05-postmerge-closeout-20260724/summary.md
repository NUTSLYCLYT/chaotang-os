# 变更摘要：fix-r0-w05-postmerge-closeout-20260724

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | fix-r0-w05-postmerge-closeout-20260724 |
| 类型 | fix |
| 状态 | GREEN_VERIFIED_AWAITING_EXACT_REVIEW |
| Owner | Project Owner / Execution Authority |
| 创建日期 | 20260724 |

## 范围

- 主线：在 PR #17 已合并后纠正 W05 当前证据，并让 execution-authority v2
  进入静默 closeout。
- 固定基线：
  `origin/feature-chaotang-ext@ad77c16d1820c0c1420845c2b7a3d8cb9e52894e`。
- 文件：本 change、W05 当前状态证据、execution-authority v2 manifest 与
  real-repo closeout tests。
- 状态变化：`R0-W05 ACTIVE -> MERGED_AND_VERIFIED`；
  `activeWorkPackage: R0-W05 -> null`。
- 禁止范围：不修改 frontend、backend、产品契约、migration、运行时逻辑；
  不激活 W06，不 push，不 merge。
- 验证：RED→GREEN authority tests、W05/W06 CLI、amendment、root/backend
  doctor、diff/allowlist 与 exact-SHA 独立审查。

## 已确认合并事实

| Identity | Value |
| --- | --- |
| Gitee PR | `https://gitee.com/msxn/chaotang-os/pulls/17` |
| Merge commit | `ad77c16d1820c0c1420845c2b7a3d8cb9e52894e` |
| Merge parents | `3cb508e06464de78facae09b93c132eb16023f94` + `a8f7816120b24bcbf12a40e2b971222583f25371` |
| Merge tree | `354e427354adfc234b89deeaac2ee937048b9ca2` |
| Candidate H3 tree | `354e427354adfc234b89deeaac2ee937048b9ca2` |
| Post-merge core | `84 passed`；Ruff、diff、root/backend doctor 通过 |

PR #17 的 merge tree 与已审查候选完全相同；本 Packet 不重新解释或改写产品实现。

## 授权

Product Owner 于 2026-07-24 明确批准：

> 批准以
> origin/feature-chaotang-ext@ad77c16d1820c0c1420845c2b7a3d8cb9e52894e
> 为 base，建立 R0-W05-POSTMERGE-CLOSEOUT 单写者 Packet；仅修正 PR #17
> 合并后的证据状态，并将 W05 从 ACTIVE 关闭为 MERGED_AND_VERIFIED、
> activeWorkPackage 置空；W06 保持未激活和 STOP。禁止修改业务代码、前端、
> 后端运行逻辑，不推送、不合并，候选 exact SHA 另行送审。
