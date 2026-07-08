# Release Scope · 先知和导师最小真闭环

> 日期：2026-06-06
> 状态：release candidate scope
> 目标：尽快上线一个能被真实老板使用和验收的“先知和导师”最小真版本。

## 1. 上线主语

本次上线主语不是“朝堂所有页面”，也不是“铭硕定制系统”。

本次上线主语是：

```text
先知和导师：帮助用户用 AI agent 解决一个真实问题。
```

朝堂 OS 是治理表达，三省六部是会审框架，铭硕是第一个样板。

## 2. 唯一上线闭环

```text
真实问题
  -> 上书房下旨
  -> 军机处会审
  -> 真模型 / 真蜂群产出奏折
  -> 用户采纳、打回或追问
  -> 史馆归档证据
```

成功不是页面数量，而是用户看完结果后愿意说：

```text
这帮我了。
```

## 3. 当前固定入口

- 前端 SoT：`/home/ubuntu/workspace/chaotang-web-lyt`
- 后端 SoT：`/home/ubuntu/workspace/jiqun_ai`
- production preview：`http://localhost:3050/chaotang`
- dev preview：`http://localhost:3002`
- 禁用端口：`3001`

## 4. 本次只允许做

1. 修复上线阻断：build、登录、basePath、核心 API、主线测试。
2. 跑通一条真闭环：上书房 / 军机处 / 奏折 / 史馆。
3. 标清真能力与降级边界：LIVE / MIXED / DEMO 不得混淆。
4. 留下证据：命令结果、截图、日志、用户验收原话。
5. 把本轮命令方式沉淀进史馆 Codex 命令库。

## 5. 本次明确不做

- 不铺新部门页。
- 不继续扩展 Battery Exchange，除非它就是本次真实问题的必要样板。
- 不新增插件、skill 或大型框架。
- 不重构视觉系统。
- 不把 mock / fallback 包装成真实模型或真实数据。
- 不为了“看起来完整”暴露未验收页面给客户。

## 6. 放行闸门

| 闸门 | 必须结果 |
|---|---|
| 前端构建 | `npm run build` pass |
| 前端 production | `3050 /chaotang` 核心入口可登录访问 |
| 浏览器 QA | 上书房、军机处、史馆至少各 1 张截图 |
| 后端主线测试 | 主线测试 pass；历史噪音单列 release debt |
| 安全 | auth、public route、mock fallback、secrets 复核 |
| 用户验收 | 真实用户完成一次决策并给出明确反馈 |

## 7. 回滚规则

发现 Critical / High 安全问题、production 入口不可访问、真闭环无法解释数据来源时，不上线公网。

回滚优先级：

1. 关闭入口或隐藏未验收导航。
2. 回滚前端到上一个可访问 commit。
3. 后端回滚到远端干净分支。
4. 保留证据，写入史馆复盘。

## 8. 下一步执行命令模板

```text
目标：
  把“真实问题 -> 军机处会审 -> 真奏折 -> 史馆归档”跑成可演示上线闭环。

上下文：
  - 前端 SoT：/home/ubuntu/workspace/chaotang-web-lyt
  - 后端 SoT：/home/ubuntu/workspace/jiqun_ai
  - 本次不追全站，只追先知和导师最小真闭环。

禁区：
  - 不新增页面和插件。
  - 不碰 3001。
  - 不把 mock/fallback 当真能力。
  - 不回滚用户未授权改动。

验收：
  - npm run build pass。
  - production 3050 核心入口可访问。
  - 浏览器截图证明上书房/军机处/史馆可用。
  - 后端主线测试 pass 或 release debt 明确隔离。
  - 输出一份可读奏折并归档。

输出：
  - 文件清单、验证命令、截图路径、剩余风险、下一步最小动作。
```
