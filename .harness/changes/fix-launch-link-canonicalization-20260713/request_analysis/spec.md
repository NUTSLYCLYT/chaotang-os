# 规格说明：fix-launch-link-canonicalization-20260713

## 背景

首发页面仍预取退役路径；Next Link/router 又手工添加 basePath，生成双前缀。

## 范围

军机处/大殿改用 shangshufang/shiguan；户部让 Next 自己处理 basePath。

## 非目标

不增加旧路由兼容，不改页面结构。

## 验收标准

相关页面无 404，户部不出现 `/chaotang/chaotang`。

## 验证计划

TDD、tsc、build、strict final harness。
