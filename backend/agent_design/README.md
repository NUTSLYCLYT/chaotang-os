# Agent Design 设计文档

本目录存放朝堂 OS 的 Agent 设计文档，包含各部门、蜂群、角色的职责定义、协作关系和上下文契约。

这是**设计文档目录**，不是 harness 运行包。文档描述 Agent 应该如何工作；运行验证由 `backend/harness/` 的对应 harness 负责。

## 目录结构

```text
agent_design/
  buildAgent/
    三省六部体系/      中书省、门下省、尚书省及六部 Agent 设计
    储能售后蜂群/      储能产品售后诊断蜂群（5 个角色）
    市场OPC团队/       市场 OPC 五人组蜂群
    搜索简历/          简历搜索 Agent
    肖艺-电芯测试工程师/
    肖艺-项目管理PM/
    郝龙-智能体市场/   获客、归档、触达、发布四角色蜂群
    郭云辉-产品部/     六角色产品部门蜂群
    马景博-电芯搜寻Sourcing/
```

## 使用规则

- 每个角色目录下的 `AGENTS.md` 是该角色的职责、输入输出和边界定义。
- 修改 Agent 设计时同步更新对应 `AGENTS.md`；如涉及路由规则变更，同步更新 `backend/src/chaotang_department_router.py`。
- 不要在本目录存放运行脚本、golden case、测试或 provider 配置——这些属于 `backend/harness/` 或 `backend/src/`。

## 与 harness 的关系

| 内容 | 位置 |
| --- | --- |
| Agent 职责与边界定义 | `agent_design/`（本目录） |
| 部门协议运行验证 | `harness/chaotang_department_protocol/` |
| 运行时 prompt | `runtime_prompts/` |
| 蜂群工具矩阵 | `harness/swarm-tool-matrix/` |
