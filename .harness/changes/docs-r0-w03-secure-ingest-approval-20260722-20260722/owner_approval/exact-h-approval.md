# Product Owner Exact-H Approval — R0-W03 Entry

| Field | Approved value |
| --- | --- |
| Approver | `lyt` |
| Date | `2026-07-22`（Asia/Shanghai） |
| Amendment ID | `R0-TRUSTED-KERNEL-AMENDMENT-01` |
| Work package | `R0-W03`（安全摄取与租户隔离） |
| Effective base | `origin/feature-chaotang-ext@b5106ba7a59876f7502565a6e84ffc055eedbb76` |
| Candidate H | `b5106ba7a59876f7502565a6e84ffc055eedbb76`（= effective base，本批准针对"从此状态开始建 W03"） |
| Tree | `252a8c3630fc3227fcd927b5b0797bf177eecc18` |
| Approved scope | 仅进入 `R0-W03` 实现（安全摄取：MIME/加密/损坏/宏/zip bomb/注入检查、OCR 状态、
  immutable input version/digest、purpose authz、短时下载票据、provider allowlist；租户隔离：
  内部运营默认不可读合同正文） |
| Explicitly not approved | `R0-W04`–`R0-W09` runtime、真实客户数据、上线 |

## OQ-02/OQ-06 冻结确认（同一批准动作内一并冻结）

```
OQ-02（文件大小/页数阈值，DOCX 首刀，OCR N/A）：
  最大上传 20MB；页数上限 100 页（docProps/app.xml 有缓存值时才检查，读不到不硬拒）
OQ-06（Provider R0 合成数据最小 policy）：
  provider_policy.yaml 上线时全部 provider 字段 UNKNOWN/None/false（fail-closed 空白态）；
  真实合规值（region/retention/no_training/subprocessors_declared）留待 Product/Security
  后续对每个实际使用的 provider 单独批准，本次不预先填入任何"看起来合理"的值
```

安全设计确认：
- 内部运营/平台人员（仅 `role=="admin"` 可引用）默认拒绝读合同正文，R0 阶段零破玻璃例外
- 真病毒扫描（ClamAV 级别）明确排除在 R0 范围外，只做结构性宏/zip-bomb 检查，此边界写入
  测试文件 docstring，不得悄悄冒充完整杀毒

## Approval statement

> 我（lyt）批准 R0-TRUSTED-KERNEL-AMENDMENT-01 的 R0-W03 work package 从
> effective base=`origin/feature-chaotang-ext@b5106ba7a59876f7502565a6e84ffc055eedbb76`
> 开始实现；同时确认冻结 OQ-02（20MB/100页阈值）与 OQ-06（provider policy 上线全 UNKNOWN
> fail-closed 空白态）、admin 默认拒读正文零例外、真病毒扫描排除在 R0 范围外这四项设计确认。
> 批准仅进入 R0-W03 实现，不批准 R0-W04–R0-W09 runtime，不批准真实客户数据，不批准上线；
> 专业安全、法律和发布负责人重新指定门在 R0-W08/R0-W09/真实客户数据前必须完成，由
> execution-authority v2 运行时阻断。

## Boundary

本证据只授权 R0-W03 范围内的实现工作。W03 合入并 MERGED_AND_VERIFIED 后，进入静默收口态
（`activeWorkPackage=null`），Product Owner 需再对 R0-W04 单独批准，本证据不预先授权。
