"""R0-W02 合同契约 taxonomy 单一定义源（OQ-03 冻结值）。

见 .harness/changes/docs-r0-trusted-kernel-amendment-20260720/amendment.md packet card
R0-W02 与 .harness/changes/docs-r0-w02-shared-contract-approval-20260721-20260721/
owner_approval/exact-h-approval.md（Product Owner 冻结记录）。

范围严格等于 amendment 原句："采购/销售/服务、中国大陆、中文、我方角色、五种裁决；未知/超范围
fail closed"。`UNSUPPORTED_OR_UNKNOWN` 哨兵值用于让"已知但超范围"走结构化拒答，跟原始陌生
字符串（触发 Pydantic ValidationError）区分开——两条路径都不静默放行。

不套用 department_identity.py 的 YAML+projection 模式：这里只有单维度、3-5 个值、不需要跨
命名空间投影，Literal + ConfigDict(extra="forbid") 已经免费拿到 fail-closed 效果。
"""

from __future__ import annotations

from typing import Literal

Jurisdiction = Literal["CN_MAINLAND", "UNSUPPORTED_OR_UNKNOWN"]
ContractLanguage = Literal["zh-CN", "UNSUPPORTED_OR_UNKNOWN"]
ContractType = Literal["procurement", "sales", "service", "UNSUPPORTED_OR_UNKNOWN"]
OurRole = Literal["buyer", "seller", "service_provider", "other_party", "UNSUPPORTED_OR_UNKNOWN"]
LegalQuestion = Literal["contract_risk_screening", "UNSUPPORTED_OR_UNKNOWN"]
ContractVerdict = Literal[
    "NEED_INFO",
    "REVISE_BEFORE_PROCEED",
    "PROCEED_TO_HUMAN_APPROVAL",
    "BLOCKED",
    "NEED_LEGAL_REVIEW",
]

UNSUPPORTED_SENTINEL = "UNSUPPORTED_OR_UNKNOWN"

DeclineReason = Literal[
    "MISSING_JURISDICTION",
    "MISSING_LANGUAGE",
    "MISSING_CONTRACT_TYPE",
    "MISSING_ROLE",
    "MISSING_LEGAL_QUESTION",
    "UNSUPPORTED_JURISDICTION",
    "UNSUPPORTED_LANGUAGE",
    "UNSUPPORTED_CONTRACT_TYPE",
    "UNSUPPORTED_LEGAL_QUESTION",
    "CAPABILITY_NOT_ACTIVATED",
    "UNKNOWN_SCOPE",
]
