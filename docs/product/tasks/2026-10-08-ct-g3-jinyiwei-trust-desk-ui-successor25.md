# 任务：锦衣卫真实性案牍台 UI 垂直切片（successor25）

## Status

In Progress

## Product Definition

- 将真实性评估接入锦衣卫只读案牍台。
- 让用户看到证据等级、状态、可信度区间、评估依据、支持/反向证据和不得推断说明。
- 提供区域级证据地图投影；没有经证据支持的坐标不得显示为精确位置。

## Delivery Constraints

- 只修改 manifest 指定的前端 BFF、类型、案牍台组件和测试路径。
- 前端只读，不新增采集、编辑、采纳或删除入口。
- 后端已有 trust API 作为唯一数据源，前端严格校验响应结构。
- 本 successor 只修复 Windows 主机上的治理验证器执行入口，不扩大 productPaths 或非目标边界。

## Acceptance Criteria

- [ ] 案卷展开后加载真实性评估并显示状态徽章。
- [ ] 评估抽屉显示可信度区间、维度、支持证据、反向证据和不得推断原因。
- [ ] 区域级地图投影只使用证据 coverage，不猜测坐标。
- [ ] 未知或非法响应安全降级，不阻塞案卷正文。
- [ ] 前端 build、lint、test、typecheck 全部通过。

## Implementation Report

- 改动摘要：沿用 successor23 的已实现 UI 垂直切片，重锚定到 successor24 审批头。
- 验证：使用 Node 入口调用本地 Next、ESLint、Node test runner 和 TypeScript，避免固定 Linux npm 路径。
- 剩余风险：真实地图底图和新闻事件聚类在后续独立阶段。
