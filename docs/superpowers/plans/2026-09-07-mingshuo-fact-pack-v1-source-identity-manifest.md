# Mingshuo Fact Pack V1 Approved Source Provenance

任务：`MINGSHUO-FACT-PACK-V1-SOURCE-IDENTITY-MANIFEST-EXACT8-CORRECTIVE-SUCCESSOR-20260907`

状态：`DRAFT / NON_AUTHORIZING / PREIMAGE_FROZEN_FOR_OWNER_REVIEW`

本文件是未来 approval commit 的静态信任锚。候选只能重物化与下述 manifest 和四份来源身份完全一致的字节；缺失、重复、额外、乱序、路径逃逸、符号链接、硬链接、模式、字节数或 SHA-256 漂移均失败关闭。Git 管理的来源不要求 uid 0；固定解释器 `/usr/bin/python3.12` 要求 root-owned、regular、non-symlink、单链接、不可 group/world writable，且版本精确为 `Python 3.12.3`。

Node relay 使用 `O_NOFOLLOW` 打开来源并在读取前后复核 inode、device、link count、mode、size、mtime 与 ctime。Python 不再按工作树路径重新导入 evaluator 或 schema，而只执行 Node 已验证并通过封闭二进制帧传入的字节。未来 machine candidate verification 必须独立绑定 exact8 的精确 `5 ADD + 3 MODIFY`、八文件模式、字节数、raw SHA-256 与 bundle；本文件及 manifest 的自洽复制不产生 candidate、运行或发布身份。

<!-- mingshuo-source-provenance:start -->
{"schemaVersion":"mingshuo.fact-pack.approved-source-provenance.v1","manifest":{"path":"docs/contracts/mingshuo-project-fact-pack.source-provenance.v1.json","mode":"100644","bytes":752,"rawSha256":"sha256:cc16c8356677ce8e5adfca3a410b20a6b4241aef16408c79010557ac9b568f75"},"sources":[{"path":"backend/app/mingshuo/fact_pack.py","mode":"100644","bytes":8106,"rawSha256":"sha256:4921205d17b8d5ee4cece8518a00df33e09f83426985d9e3e1bdc14795f17249"},{"path":"docs/contracts/mingshuo-project-fact-pack.schema.json","mode":"100644","bytes":6464,"rawSha256":"sha256:f8ce4c6d194f4901c7e0a099b32c3b4ac01bc7d167622c87cd860c13a06c7605"},{"path":"docs/contracts/mingshuo-project-fact-pack.v1.golden.json","mode":"100644","bytes":430,"rawSha256":"sha256:1123b2ada2e966aabbeb8a29a882b0fedffffa1ffe9986eebdaca21c305be737"},{"path":"scripts/mingshuo-fact-pack.mjs","mode":"100644","bytes":13273,"rawSha256":"sha256:60d8572f9fc029714c942f1cf6d42417e93dc32d4d31b740daf4c486034f8fb5"}]}
<!-- mingshuo-source-provenance:end -->

本文件的 raw identity 由未来正式 approval 中的 exact8 machine verification 命令绑定，不嵌入自身摘要，避免自哈希递归。四治理文件 bundle 同理只在外部验收回报中冻结，不写回其成员。

本文件不授予 product authority、candidate、push、发布或部署身份。
