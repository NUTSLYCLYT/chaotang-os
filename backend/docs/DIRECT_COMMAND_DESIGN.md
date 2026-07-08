# 密旨直通车 - 技术设计文档 v1.0

## 一、需求背景

### 当前痛点
1. 入口分散：用户需要选择蜂群、理解丞相流程
2. 步骤繁琐：起草 -> 分派 -> 等待 -> 查看结果
3. 缺乏直通：简单任务也要走完整流程

### 目标
- 一条命令：用户直接输入任务
- 智能路由：自动判断使用哪个系统
- 直接输出：结果或文件直接返回

## 二、核心API

POST /api/direct/execute

请求：
- command: 任务描述
- mode: auto/court/swarm/direct
- output_format: json/markdown/text/file
- async: true/false
- stream: true/false
- save_to_file: 路径

## 三、智能路由

三层路由：
1. 简单问题 -> direct LLM (<1s)
2. 领域关键词 -> swarm 直连 (<3min)
3. 复杂决策 -> court 丞相协调 (<10min)

## 四、执行模式

| 模式 | 响应时间 | 适用场景 |
|------|---------|---------|
| direct | <1s | 简单问答 |
| swarm | <3min | 专业任务 |
| court | <10min | 复杂决策 |

## 五、讨论点

1. 路由准确性如何保证？
2. 是否需要缓存层？
3. 流式输出优化？
4. 错误降级策略？