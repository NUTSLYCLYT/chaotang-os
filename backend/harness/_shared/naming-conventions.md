# Harness 命名规范

本文档定义 `backend/harness/` 目录下各类目录的命名规则。

## 规则汇总

| 类型 | 命名格式 | 示例 |
| --- | --- | --- |
| **主 harness**（自包含） | `snake_case` | `chaotang_department_protocol` |
| **主 harness**（文档入口，委托实现包） | `kebab-case` | `legal-redteam`、`jinyiwei-scrapling-poc` |
| **实现包** | `snake_case` | `legal_redteam`、`jinyiwei_scrapling_poc` |
| **共享基础设施** | `kebab-case` 或 `snake_case` | `_shared/`、`changes/` |

## 详细说明

### 主 harness

新建主 harness 统一使用 **snake_case**，与 Python 模块命名保持一致，便于脚本引用。

已有 kebab-case 主 harness（`chaotang-commercial-loop`、`chaotang-true-loop`、`swarm-tool-matrix`）保持不变，不做破坏性重命名。

### 文档入口 + 实现包拆分

当一个主 harness 仅存放契约/说明，实际运行代码在独立实现包中时：

- 主 harness 目录（doc entry）沿用 kebab-case：`legal-redteam/`
- 对应实现包目录使用 snake_case：`legal_redteam/`
- `manifest.json` 中主 harness 条目通过 `"implementation"` 字段指向实现包 ID

```json
{
  "id": "legal-redteam",
  "implementation": "legal_redteam"
}
```

### 实现包

实现包目录必须使用 **snake_case**，因其通常作为 Python 包被导入或被 `harness_doctor.py` 按 Python 路径引用。

### 共享基础设施

`_shared/` 子目录（`contracts/`、`gates/`、`observability/`）使用小写单词，无分隔符约束，优先可读性。

## 历史遗留说明

以下目录存在 kebab/snake 双重条目，均已在 `manifest.json` 中明确角色，不视为错误：

| kebab（文档入口） | snake（实现包） |
| --- | --- |
| `jinyiwei-scrapling-poc/` | `jinyiwei_scrapling_poc/` |
| `legal-redteam/` | `legal_redteam/` |

## 检查工具

`python scripts/harness_doctor.py` 会按 `manifest.json` 中声明的 `id` 验证目录是否存在，不对命名格式做强制 lint，但新增条目时需遵循本文档规则。
