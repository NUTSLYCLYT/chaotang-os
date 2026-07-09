---
name: frontend-doctor
description: 当前端 harness、构建、测试或边界出现问题时进行排查。
---

# 前端 Doctor Skill

## 默认顺序

1. 运行 `node scripts/harness-doctor.mjs`。
2. 读取报错文件。
3. 判断是入口文档、harness 结构、change 记录、脚本还是业务代码问题。
4. 修复最小必要文件。
5. 重新运行最小失败命令。
6. 判断问题属于前端、根级项目协调还是跨线。

## 输出

- 根因。
- 修复内容。
- 验证命令。
- 剩余风险。
