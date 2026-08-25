# EXT Full-Value Convergence V2 Delta Addendum

状态：**DRAFT / NON-AUTHORIZING / STOP**  
观察基线：`origin/ext-dev@82ba658db44d829d6ae7e028dcbac7ecefb4cee7`  
Manifest：`docs/migrations/2026-08-25-ext-full-value-convergence-v2-delta-addendum.v1.json`  
Manifest SHA-256：`sha256:ab4c9393c1ce41f813d966d98b102ed82800231be2b521dc91d47f0db9af8b34`

## 裁决结论

本 Addendum 不替代、不修改、也不重审原 V2 Receipt。原 Receipt 确认的 823 个 review unit、`ctc-ext-20260812-edf245a7 = KEEP_BLOCKED`、零 override、无产品或 Packet 权限全部保持原状。

新增观察严格记为 894 个精确单元：1 个新 ref 内容树、890 个工作树条目、3 个不可用工作树。它们被压缩为 12 个内容寻址批次；另对 2 个漂移外部来源和 1 个新增别名分类保护作出独立裁决，共 15 个批次级人工决策。

所有工作树增量均为用户或工作资产：**PRESERVE / EXCLUDE_PRODUCT**。3 个不可用工作树和 2 个漂移外部来源保持 **KEEP_BLOCKED**。7 份 P14 候选仅为 **AUDIT_CLUSTER_ONLY**，没有候选被选择、复用、提交、推送或激活。

## 894 单元批次账

| 批次 | 精确单元 | 处置 | 产品资格 | 用途 |
|---|---:|---|---|---|
| governance-drafts-audit-only | 49 | PRESERVE | EXCLUDE_PRODUCT | AUDIT_ONLY |
| new-ref-trusted-artifact-delivery-audit | 1 | PRESERVE | EXCLUDE_PRODUCT | AUDIT_ONLY_EXISTING_CAPABILITY_EVIDENCE |
| p14-audit-chaotang-p14-current-dn9n2u-09c40219 | 30 | PRESERVE | EXCLUDE_PRODUCT | P14_AUDIT_CLUSTER_ONLY |
| p14-audit-ext-dev-baseline-20260823-381f19dc | 30 | PRESERVE | EXCLUDE_PRODUCT | P14_AUDIT_CLUSTER_ONLY |
| p14-audit-p14-exact30-authority-current-20260824-a0188b7e | 30 | PRESERVE | EXCLUDE_PRODUCT | P14_AUDIT_CLUSTER_ONLY |
| p14-audit-p14-reviewed-remediation-authority-20260823-8cdcb2aa | 30 | PRESERVE | EXCLUDE_PRODUCT | P14_AUDIT_CLUSTER_ONLY |
| p14-audit-p14-v2-product-20260823-bb06cb98 | 30 | PRESERVE | EXCLUDE_PRODUCT | P14_AUDIT_CLUSTER_ONLY |
| p14-audit-p14-v3-product-20260823-fea6a2b2 | 32 | PRESERVE | EXCLUDE_PRODUCT | P14_AUDIT_CLUSTER_ONLY |
| p14-audit-p14-v3-r2-product-20260824-875125b5 | 32 | PRESERVE | EXCLUDE_PRODUCT | P14_AUDIT_CLUSTER_ONLY |
| unavailable-independent-worktree | 1 | KEEP_BLOCKED | EXCLUDE_PRODUCT | NONE_UNTIL_SEPARATE_FREEZE |
| unavailable-p14-amendment-aliases | 2 | KEEP_BLOCKED | EXCLUDE_PRODUCT | NONE_UNTIL_SEPARATE_FREEZE |
| user-assets-main-worktree | 627 | PRESERVE | EXCLUDE_PRODUCT | AUDIT_ONLY |

合计：**894**。完整 894 单元的路径、内容摘要、分类观察、批次归属和 leaf digest 均在 JSON manifest 内。

## P14 七候选审计聚类

| 工作树聚类 | 单元 | Head | Tree | 内容清单摘要 |
|---|---:|---|---|---|
| chaotang-p14-current-dn9n2u-09c40219 | 30 | 82ba658db44d829d6ae7e028dcbac7ecefb4cee7 | 63e8c716f705d559b51169da9d1b80b7db4afccf | `sha256:ba79842799a542d9f2516fd951f3ded154c957b54fbfb3e66b9197906119bb91` |
| ext-dev-baseline-20260823-381f19dc | 30 | 76839a8e8fc4814fb327debbd3a0f18b6409b7d8 | a6839a6c8774524f932a6c67fa092c585485908a | `sha256:592ba3655b8a02446b997ae8c2eda27d6996fd41ad350f699f14c6ce1bf4daa1` |
| p14-exact30-authority-current-20260824-a0188b7e | 30 | c174872f42c31b3d7a20c727a7c42c4a136c45dc | 88cd84e6fd5ef54847cc56a56c2fcec3e7aa3655 | `sha256:84a7f0207531d1c99a26c1251211ee185327efdd454efc56a2989140d580eaf7` |
| p14-reviewed-remediation-authority-20260823-8cdcb2aa | 30 | 49634a4a857e1c29ff1819ca0fd661f4ca5fa148 | 45c06766bddd2cc42faaf1679d839ba4f70dfe53 | `sha256:4517e10f5c72bf229457c5d7fead32db492a78951d1a9c583d508817215db91c` |
| p14-v2-product-20260823-bb06cb98 | 30 | 49634a4a857e1c29ff1819ca0fd661f4ca5fa148 | 45c06766bddd2cc42faaf1679d839ba4f70dfe53 | `sha256:1d6c2887194735796822b979731c66e40e768039b66a6958c9006a36338cbe13` |
| p14-v3-product-20260823-fea6a2b2 | 32 | a923805f8de2a2da9866b24ec6d2f27add113b19 | 082476e9075788223b8c712f51bcaccc429d4648 | `sha256:6ca8e66e63e08690162787cfa98edcd4c0a4f98eb1ac20da65f2d9a28819bed9` |
| p14-v3-r2-product-20260824-875125b5 | 32 | 4d109ca5f021ad62e5158d0b9266d93710f77f60 | e004bc607d260f158ea82350a49f89ab9c8583f8 | `sha256:9b4b8fb734acba84195ac73cf500b1b98efdee50c8ea56fd24eb20e90269d64e` |

这些摘要只证明“观察到了哪些字节”，不证明候选正确、可发布或被授权。

## 保护性裁决

- 用户资产：全部保留，排除进入产品候选。
- 旧分类：新增 alias 只作为审计元数据，不能降低原 V2 Receipt 已确认的内容树分类。
- 不可用工作树：2 个同型 P14 amendment 工作树虽可技术聚类，仍按 2 个精确单元分别记账；另 1 个不可用工作树独立记账，三者全部 KEEP_BLOCKED。
- 外部漂移：`courtos-brain-raw-vault:02` 与 `frontend-courtos-second-brain:03` 保持 KEEP_BLOCKED，不作为 canonical donor。
- 新 ref 内容树：仅作为既有 `trusted-artifact-delivery` 能力的审计证据，不新建能力、不激活迁移。

## 边界与下一门

本轮没有运行 authority、没有创建产品候选、没有提交、推送、部署或进入产品施工。两份 Addendum 文件在观察完成后生成，并明确排除在固定的 894 单元之外。若放弃本草案，只需删除这两份未提交文件；产品和运行时状态没有变化。

下一步只能先审批 manifest 与 packet digest。即使治理 Addendum 获批，也不会自动授予产品施工权。
