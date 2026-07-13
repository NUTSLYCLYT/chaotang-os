# 需求说明

## 背景

旧 packager 仍输出退役仓库身份，可能让新 monorepo 构建继续被旧部署脚本识别为旧产品。用户要求每个旧入口先 RED，再收编到唯一主线。

## 范围

- 将 package identity 改为 `chaotang-os-frontend`。
- 新增聚焦契约测试并生成一次真实 tar。
- 由根 harness 登记清算与遥测规则。

## 非目标

- 不部署、不接管 3050、不删除旧入口、不改 UI/API/数据库。

## 验收标准

- source contract RED→GREEN。
- 实际 tar 顶层、manifest.app 和 INSTALL 使用 canonical identity。
- build/type/正式主链/doctor 通过，prod doctor 仍 STOP。

## 风险

外部脚本可能依赖旧 tar 名；调用量未知，必须保留观察并由后续遥测证明。

## 验证计划

见 `ci_result/ci_summary.md`。
