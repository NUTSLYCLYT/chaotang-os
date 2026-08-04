# 39 司独立运行时 Skill 文件设计

## 背景

当前 39 个司已经拥有独立的 `RuntimeSkillDefinition`、专业方法和 Tool Policy，但物理定义集中在 `roles/bureaus/professional.py`，Skill ID 又分散在六个部门文件。逻辑边界已经存在，源码所有权边界尚未建立，导致单文件过大、多人修改冲突，并增加 Skill 方法与 Tool Policy 不同步的风险。

用户于 2026-08-04 确认将每个司拆成独立运行时 Skill 文件。这里的 Skill 是项目后端运行时定义，不是 Codex 的 `SKILL.md`。

## 目标

- 39 个权威司各有且仅有一个 Python 定义文件。
- 每个文件共同声明身份、Skill ID、专业方法和 Tool Policy。
- 保持所有 Agent ID、Skill ID、Policy ID、版本、方法文本、权限、预算和运行结果逐字节等价。
- 中央注册表显式导入 39 个定义，并在启动时拒绝缺失、重复、额外定义和 fallback。
- 允许后续按司分派开发、审查和测试，不再共同编辑一个超大文件。

## 非目标

- 不新增、删除或重命名任何司。
- 不改变四个 Tool、Evidence Protocol、Tool Loop、ResultGate、审计或报告契约。
- 不改变部级、军机处、丞相或 LangGraph 四节点拓扑。
- 不引入动态目录扫描、字符串插值注册、通用 Policy 或自动补齐。
- 不创建 39 个 Codex `SKILL.md`。

## 文件结构

```text
backend/app/agents/runtime_skills/roles/bureaus/
├── skill_spec.py
├── skill_registry.py
├── professional.py              # 兼容门面，不再保存定义正文
├── libu.py / hubu.py / ...      # 兼容 Skill-ID 门面
└── skills/
    ├── __init__.py
    ├── libu_appointments.py
    ├── libu_recruitment.py
    ├── ...
    └── gongbu_commitments.py     # 共 39 个文件
```

`skill_spec.py` 定义冻结的 `BureauMethod`、`BureauToolPolicySpec` 和 `BureauRuntimeSkillSpec`。`BureauRuntimeSkillSpec` 是单司文件的唯一顶层产物，字段至少包含 `department`、`bureau`、`agent_id`、`skill_id`、`method` 和 `tool_policy`。

每个 `skills/<agent_id>.py` 只导出一个 `SKILL`。Skill ID、专业方法和 Policy 必须同文件变更，禁止跨文件拼装单个司的定义。

`skill_registry.py` 使用 39 条显式 import 构造不可变 `BUREAU_SKILL_SPECS`，并派生兼容映射。禁止 `pkgutil`、`glob`、目录扫描、名称推导和缺省填充。

## 兼容策略

- `professional.py` 暂时重导出 `BureauMethod`、`BureauToolPolicySpec`、`BUREAU_METHODS` 和 `BUREAU_TOOL_POLICY_SPECS`，其值必须完全来自中央注册表。
- 六个部门 Skill-ID 文件暂时重导出按部门派生的 `SKILL_IDS`。
- `runtime_skills/registry.py` 改为优先消费 `BUREAU_SKILL_SPECS`，但对外注册结果、顺序和对象字段保持不变。
- 兼容门面不得复制定义正文；测试必须证明只有 39 个源定义。

## 注册与失败策略

启动验证同时比较：

1. `BUREAU_PROFILES` 的 39 个 `(department, bureau)`；
2. 39 个 `BureauRuntimeSkillSpec` 的身份集合；
3. Agent ID、Skill ID、Policy ID 的唯一性；
4. 方法与 Policy 的完整字段；
5. Tool Policy 注册表派生结果；
6. 原有 Runtime Skill 注册顺序和数量。

任一缺失、重复、额外定义、身份不匹配或兼容映射偏差都在导入/启动时 fail closed，不允许 fallback。

## 迁移方式

迁移分六个部门批次进行。每个批次先建立源数据快照测试，再移动定义；同一批次必须证明迁移前后序列化快照完全一致。全部迁移后，删除 `professional.py` 中的正文和六个 ID 文件中的手写映射，只保留派生门面。

## 验证

- 39 文件、39 `SKILL`、39 唯一 Agent/Skill/Policy ID。
- 迁移前后完整规范快照相等。
- Tool descriptor、Policy fingerprint、Runtime Skill registry 和 39 司生产矩阵不变。
- 四工具、Evidence 单循环、上层隔离和四节点回归通过。
- 最终冻结版本按仓库规则连续完整通过至少 10 轮；任何实质变化从第 1 轮重计。

## 风险

- 手工搬运可能产生文本或约束漂移：以迁移前快照和逐字段对比阻断。
- 39 个模块可能形成循环导入：单司文件只依赖 `skill_spec.py` 与 Tool 枚举；中央注册表单向依赖单司模块。
- 兼容门面可能长期残留：本次只承诺零行为迁移，不在同一变更删除公共旧导入。
